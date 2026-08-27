"""In-process pub/sub for Red Team Live Monitor events (one stream per campaign)."""

from __future__ import annotations

import asyncio
import itertools
from collections import defaultdict, deque
from datetime import UTC, datetime
from typing import Any, Literal

Outcome = Literal["pass", "fail", "flag"]
AgentName = Literal["research", "curator", "red_team", "target", "judge", "defender"]
AgentState = Literal["idle", "running", "done"]

LIVE_AGENTS: tuple[AgentName, ...] = (
    "research",
    "curator",
    "red_team",
    "target",
    "judge",
    "defender",
)


def _now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def default_agents(state: AgentState = "idle") -> dict[str, AgentState]:
    return {name: state for name in LIVE_AGENTS}


class CampaignLiveBus:
    """Per-campaign event history + fan-out to WebSocket subscribers."""

    def __init__(self, history_size: int = 1000) -> None:
        self._seq = itertools.count(1)
        self._history: dict[str, deque[dict[str, Any]]] = defaultdict(
            lambda: deque(maxlen=history_size)
        )
        self._subscribers: dict[str, set[asyncio.Queue]] = defaultdict(set)

    def publish(self, campaign_id: str, event: dict[str, Any]) -> dict[str, Any]:
        payload = {
            **event,
            "type": "campaign_live",
            "campaign_id": campaign_id,
            "seq": next(self._seq),
            "ts": event.get("ts") or _now(),
        }
        self._history[campaign_id].append(payload)
        for queue in list(self._subscribers.get(campaign_id, ())):
            try:
                queue.put_nowait(payload)
            except asyncio.QueueFull:
                pass
        return payload

    def history(self, campaign_id: str, limit: int = 200) -> list[dict[str, Any]]:
        return list(self._history.get(campaign_id, ()))[-limit:]

    async def subscribe(self, campaign_id: str) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=300)
        self._subscribers[campaign_id].add(queue)
        return queue

    def unsubscribe(self, campaign_id: str, queue: asyncio.Queue) -> None:
        subs = self._subscribers.get(campaign_id)
        if not subs:
            return
        subs.discard(queue)
        if not subs:
            self._subscribers.pop(campaign_id, None)


campaign_live_bus = CampaignLiveBus()


def verdict_to_outcome(verdict: str) -> Outcome:
    v = (verdict or "").upper()
    if v in {"BLOCKED", "SAFE", "PASS", "FAILURE"}:  # FAILURE of attack = pass for defense
        if v == "FAILURE":
            return "pass"
        if v in {"BLOCKED", "SAFE", "PASS"}:
            return "pass"
    if v in {"SUCCESS", "BREACH", "ATTACK_SUCCESS"}:
        return "fail"
    if v in {"PARTIAL", "FLAG", "LATE", "ERROR"}:
        return "flag"
    if "BLOCK" in v:
        return "pass"
    if "SUCCESS" in v:
        return "fail"
    return "flag"


def emit_round_events(campaign_id: str, round_result: Any) -> list[dict[str, Any]]:
    """Emit the three canonical live-feed lines for one finished round."""
    attack = getattr(round_result, "attack", None)
    response = getattr(round_result, "response", None)
    score = getattr(round_result, "score", None)
    round_no = int(getattr(round_result, "round_number", 0) or 0)

    attack_name = getattr(attack, "name", None) or "Attack"
    attack_cat = getattr(getattr(attack, "category", None), "value", None) or getattr(
        attack, "category", ""
    )
    attack_type = f"{attack_cat}: {attack_name}" if attack_cat else str(attack_name)

    resp_text = (getattr(response, "response", None) or getattr(response, "raw_response", None) or "")[
        :120
    ]
    blocked = bool(getattr(response, "blocked", False))
    verdict = getattr(getattr(score, "verdict", None), "value", None) or str(
        getattr(score, "verdict", "UNKNOWN")
    )
    outcome = verdict_to_outcome(str(verdict))

    agents_attack = default_agents("done")
    agents_attack.update(
        {"red_team": "running", "target": "idle", "judge": "idle", "defender": "idle"}
    )
    agents_resp = default_agents("done")
    agents_resp.update({"red_team": "done", "target": "running", "judge": "idle"})
    agents_judge = default_agents("done")
    agents_judge["judge"] = "running"
    agents_done = default_agents("done")
    if blocked or outcome == "pass":
        agents_done["defender"] = "done"

    emitted: list[dict[str, Any]] = []
    emitted.append(
        campaign_live_bus.publish(
            campaign_id,
            {
                "kind": "attack",
                "outcome": None,
                "actor": "red_team",
                "round": round_no,
                "attack_type": attack_type,
                "summary": f"Red Team → Target: {attack_type}",
                "agents": agents_attack,
            },
        )
    )
    emitted.append(
        campaign_live_bus.publish(
            campaign_id,
            {
                "kind": "response",
                "outcome": None,
                "actor": "target",
                "round": round_no,
                "attack_type": attack_type,
                "summary": f"Target → {resp_text or ('blocked' if blocked else 'response')}",
                "agents": agents_resp,
            },
        )
    )
    emitted.append(
        campaign_live_bus.publish(
            campaign_id,
            {
                "kind": "verdict",
                "outcome": outcome,
                "actor": "judge",
                "round": round_no,
                "attack_type": attack_type,
                "summary": f"Judge → {verdict} ({outcome.upper()})",
                "agents": agents_done,
            },
        )
    )
    return emitted


def emit_campaign_status(
    campaign_id: str,
    status: str,
    *,
    agents: dict[str, AgentState] | None = None,
) -> dict[str, Any]:
    return campaign_live_bus.publish(
        campaign_id,
        {
            "kind": "agent_status",
            "outcome": None,
            "actor": "system",
            "round": None,
            "attack_type": None,
            "summary": f"Campaign {status}",
            "agents": agents or default_agents("idle" if status == "PENDING" else "running"),
            "campaign_status": status,
        },
    )


def hydrate_from_rounds(campaign_id: str, rounds: list[Any]) -> list[dict[str, Any]]:
    """Rebuild feed from persisted rounds when bus history is empty (page reload)."""
    if campaign_live_bus.history(campaign_id):
        return campaign_live_bus.history(campaign_id)
    out: list[dict[str, Any]] = []
    for r in rounds:
        out.extend(emit_round_events(campaign_id, r))
    return out
