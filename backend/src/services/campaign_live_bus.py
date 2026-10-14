"""In-process pub/sub for Red Team Live Monitor events (one stream per campaign)."""

from __future__ import annotations

import asyncio
import itertools
import logging
from collections import defaultdict, deque
from datetime import UTC, datetime
from typing import Any, Literal

from src.core.models.hops import (
    HMAC_HANDOFF_UNWIRED,
    WIRED_ROLES,
    AgentRole,
    HmacState,
    HopEventType,
    chain_roster,
    executed_hop,
)

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

# Live Monitor ``agents`` map uses idle|running|done. Defender is conditional
# and is marked done only when its verified handoff appears in round evidence.
_WIRED_LIVE: tuple[AgentName, ...] = LIVE_AGENTS


def _now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def default_agents(state: AgentState = "idle") -> dict[str, AgentState]:
    """Stage map for the existing Live Monitor.

    Unwired agents are never marked running/done — they did not execute.
    """
    out: dict[str, AgentState] = {name: "idle" for name in LIVE_AGENTS}
    if state != "idle":
        for name in _WIRED_LIVE:
            out[name] = state
    return out


def _hop_latency(round_result: Any, agent: AgentRole) -> float | None:
    timings = getattr(round_result, "hop_latency_ms", None)
    if timings is None:
        return None
    if agent == AgentRole.RESEARCH:
        value = getattr(timings, "research", None)
    elif agent == AgentRole.CURATOR:
        value = getattr(timings, "curator", None)
    elif agent == AgentRole.RED_TEAM:
        value = getattr(timings, "red_team", None)
    elif agent == AgentRole.TARGET:
        value = getattr(timings, "target", None)
    elif agent == AgentRole.JUDGE:
        value = getattr(timings, "judge", None)
    elif agent == AgentRole.DEFENDER:
        value = getattr(timings, "defender", None)
    else:
        return None
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _evidence_id(round_result: Any, agent: AgentRole) -> str | None:
    attack = getattr(round_result, "attack", None)
    if agent == AgentRole.RED_TEAM or agent == AgentRole.TARGET:
        ident = getattr(attack, "id", None)
        return str(ident) if ident else None
    if agent == AgentRole.JUDGE:
        ident = getattr(attack, "id", None)
        return f"{ident}:verdict" if ident else None
    return None


def _hmac_for_receiver(round_result: Any, receiver: str) -> tuple[HmacState, bool | None]:
    records = getattr(round_result, "hmac_handoffs", None) or []
    for row in records:
        if not isinstance(row, dict):
            continue
        if str(row.get("receiver") or "") == receiver:
            verified = row.get("hmac_verified")
            state_raw = str(row.get("hmac_state") or "")
            if verified is True or state_raw == HmacState.OK.value:
                return HmacState.OK, True
            if verified is False or state_raw == HmacState.FAIL.value:
                return HmacState.FAIL, False
    return HMAC_HANDOFF_UNWIRED, None


def _round_handoff_statuses(
    round_result: Any,
) -> dict[AgentRole, tuple[HmacState, bool | None]]:
    """Use each receiver's own verification result; never copy one hop's HMAC to all agents."""
    return {
        AgentRole.RESEARCH: _hmac_for_receiver(round_result, "research"),
        AgentRole.CURATOR: _hmac_for_receiver(round_result, "curator"),
        AgentRole.RED_TEAM: _hmac_for_receiver(round_result, "red_team"),
        AgentRole.TARGET: _hmac_for_receiver(round_result, "target"),
        AgentRole.JUDGE: _hmac_for_receiver(round_result, "judge"),
        AgentRole.DEFENDER: _hmac_for_receiver(round_result, "defender"),
    }


def _parse_ts(round_result: Any) -> datetime:
    raw = getattr(round_result, "timestamp", None)
    if isinstance(raw, datetime):
        return raw if raw.tzinfo else raw.replace(tzinfo=UTC)
    return datetime.now(UTC)


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

        # Bridge projected campaign hop to global telemetry_bus so WebSocket clients on /websocket receive live hops
        if payload.get("hop"):
            try:
                from src.services.ops_telemetry import project_campaign_hop
                from src.services.telemetry_bus import telemetry_bus

                projected = project_campaign_hop(payload)
                if projected is not None:
                    telemetry_bus.publish(projected.model_dump(mode="json"))
            except Exception:
                logging.getLogger(__name__).debug("Campaign hop projection failed", exc_info=True)

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
    """Emit the three canonical live-feed lines for one finished round.

    Existing Live Monitor fields (kind/actor/summary/agents) are preserved.
    Each line carries the three existing Live Monitor hops and a chain roster
    reflecting the actual Research → Curator → Red Team → Target → Judge flow.
    Defender is included only when its conditional mitigation hop ran.
    """
    attack = getattr(round_result, "attack", None)
    response = getattr(round_result, "response", None)
    score = getattr(round_result, "score", None)
    round_no = int(getattr(round_result, "round_number", 0) or 0)
    hop_ts = _parse_ts(round_result)

    attack_name = getattr(attack, "name", None) or "Attack"
    attack_cat = getattr(getattr(attack, "category", None), "value", None) or getattr(
        attack, "category", ""
    )
    attack_type = f"{attack_cat}: {attack_name}" if attack_cat else str(attack_name)

    resp_text = (getattr(response, "response", None) or getattr(response, "raw_response", None) or "")[
        :120
    ]
    verdict = getattr(getattr(score, "verdict", None), "value", None) or str(
        getattr(score, "verdict", "UNKNOWN")
    )
    outcome = verdict_to_outcome(str(verdict))

    handoff_statuses = _round_handoff_statuses(round_result)
    handoffs = getattr(round_result, "hmac_handoffs", None) or []
    defender_executed = any(
        isinstance(row, dict) and str(row.get("receiver") or "") == "defender"
        for row in handoffs
    )

    # Live Monitor stage lights follow the real round order.
    agents_attack = default_agents("idle")
    agents_attack.update({"research": "done", "curator": "done", "red_team": "running"})
    agents_resp = default_agents("idle")
    agents_resp.update({"research": "done", "curator": "done", "red_team": "done", "target": "running"})
    agents_done = default_agents("idle")
    agents_done.update({"research": "done", "curator": "done", "red_team": "done", "target": "done", "judge": "done"})
    if defender_executed:
        agents_done["defender"] = "done"

    rt_state, rt_ok = _hmac_for_receiver(round_result, "target")
    judge_state, judge_ok = _hmac_for_receiver(round_result, "judge")

    red_hop = executed_hop(
        campaign_id=campaign_id,
        round_number=round_no,
        agent=AgentRole.RED_TEAM,
        event_type=HopEventType.ATTACK,
        timestamp=hop_ts,
        latency_ms=_hop_latency(round_result, AgentRole.RED_TEAM),
        evidence_id=_evidence_id(round_result, AgentRole.RED_TEAM),
        hmac_state=handoff_statuses[AgentRole.RED_TEAM][0],
        hmac_verified=handoff_statuses[AgentRole.RED_TEAM][1],
    )
    target_hop = executed_hop(
        campaign_id=campaign_id,
        round_number=round_no,
        agent=AgentRole.TARGET,
        event_type=HopEventType.RESPONSE,
        timestamp=hop_ts,
        latency_ms=_hop_latency(round_result, AgentRole.TARGET),
        evidence_id=_evidence_id(round_result, AgentRole.TARGET),
        hmac_state=rt_state,
        hmac_verified=rt_ok,
    )
    judge_hop = executed_hop(
        campaign_id=campaign_id,
        round_number=round_no,
        agent=AgentRole.JUDGE,
        event_type=HopEventType.VERDICT,
        timestamp=hop_ts,
        latency_ms=_hop_latency(round_result, AgentRole.JUDGE),
        verdict=str(verdict),
        evidence_id=_evidence_id(round_result, AgentRole.JUDGE),
        hmac_state=judge_state,
        hmac_verified=judge_ok,
    )

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
                "hop": red_hop.model_dump(mode="json"),
                "chain": [
                    m.model_dump(mode="json")
                    for m in chain_roster(
                        executed=frozenset({AgentRole.RESEARCH, AgentRole.CURATOR, AgentRole.RED_TEAM}),
                        handoff_statuses=handoff_statuses,
                    )
                ],
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
                "summary": f"Target → {resp_text or ('blocked' if getattr(response, 'blocked', False) else 'response')}",
                "agents": agents_resp,
                "hop": target_hop.model_dump(mode="json"),
                "chain": [
                    m.model_dump(mode="json")
                    for m in chain_roster(
                        executed=frozenset({AgentRole.RESEARCH, AgentRole.CURATOR, AgentRole.RED_TEAM, AgentRole.TARGET}),
                        handoff_statuses=handoff_statuses,
                    )
                ],
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
                "hop": judge_hop.model_dump(mode="json"),
                "chain": [
                    m.model_dump(mode="json")
                    for m in chain_roster(
                        executed=frozenset(
                            {*WIRED_ROLES} if defender_executed else {*WIRED_ROLES} - {AgentRole.DEFENDER}
                        ),
                        handoff_statuses=handoff_statuses,
                    )
                ],
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
    previous = campaign_live_bus.history(campaign_id, limit=1)
    previous_event = previous[-1] if previous else {}
    stage = agents or previous_event.get("agents") or default_agents("idle")
    chain = previous_event.get("chain") or [m.model_dump(mode="json") for m in chain_roster()]
    return campaign_live_bus.publish(
        campaign_id,
        {
            "kind": "agent_status",
            "outcome": None,
            "actor": "system",
            "round": None,
            "attack_type": None,
            "summary": f"Campaign {status}",
            "agents": stage,
            "campaign_status": status,
            "chain": chain,
            "hmac_state": HMAC_HANDOFF_UNWIRED.value,
            "hmac_verified": None,
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
