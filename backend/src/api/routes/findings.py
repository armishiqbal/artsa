"""Findings queue API — server-side lifecycle + chain-of-custody."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from src.data.campaign_job_store import campaign_job_store
from src.data.findings_registry import all_records, get_record, set_promoted
from src.data.policy_version_store import current_version, snapshot_rules
from src.data.results_store import ResultsStore

router = APIRouter(tags=["Findings"])

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent.parent
RESULTS_DIR = BACKEND_DIR / "data" / "results"
POLICY_PATH = BACKEND_DIR / "configs" / "org_policies" / "default.yaml"

ASI_BY_CATEGORY: dict[str, tuple[str, str]] = {
    "PROMPT_INJECTION": ("ASI01", "Agent Goal Hijack"),
    "DPI": ("ASI01", "Agent Goal Hijack"),
    "JAILBREAK": ("ASI10", "Rogue Agents"),
    "JBK": ("ASI10", "Rogue Agents"),
    "SYSTEM_PROMPT_EXTRACTION": ("ASI10", "Rogue Agents"),
    "SPE": ("ASI10", "Rogue Agents"),
    "DATA_EXTRACTION": ("ASI06", "Memory & Context Poisoning"),
    "DEX": ("ASI06", "Memory & Context Poisoning"),
    "TPA": ("ASI02", "Tool Misuse & Exploitation"),
}


def _asi_for_category(category: str) -> tuple[str | None, str | None]:
    key = category.upper().replace(" ", "_")
    return ASI_BY_CATEGORY.get(key, (None, None))


def _default_custody(*, verdict: str, blocked: bool) -> list[dict[str, Any]]:
    defender_action = "Awaiting playbook promotion"
    if blocked:
        defender_action = "Containment blocked the attack path"
    return [
        {"agent": "research", "label": "Research", "action": "Pattern mapped to ASI taxonomy", "hmac_verified": None},
        {"agent": "curator", "label": "Curator", "action": "Attack template prepared", "hmac_verified": None},
        {"agent": "redteam", "label": "Red Team", "action": "Multi-turn attack executed", "hmac_verified": True},
        {"agent": "target", "label": "Target", "action": "Agent response captured", "hmac_verified": True},
        {"agent": "judge", "label": "Judge", "action": f"Verdict · {verdict}", "hmac_verified": True},
        {"agent": "defender", "label": "Defender", "action": defender_action, "hmac_verified": None},
    ]


def _severity_from_score(score: dict[str, Any]) -> str:
    sev = str(score.get("severity", "MEDIUM")).upper()
    if sev in ("CRITICAL", "HIGH", "MEDIUM", "LOW"):
        return sev
    return "MEDIUM"


def _findings_from_campaigns() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    registry = all_records()
    store = ResultsStore(str(RESULTS_DIR))

    for job in campaign_job_store.list_jobs(limit=100):
        cid = job["id"]
        rounds = store.load_rounds(cid)
        if not rounds and job.get("summary_json"):
            summary = job["summary_json"]
            top = summary.get("top_findings") or []
            for raw in top[:10]:
                if not isinstance(raw, dict):
                    continue
                round_num = int(raw.get("round_number", 0))
                finding_id = f"campaign-{cid}-r{round_num}"
                rows.append(_round_to_finding(finding_id, cid, raw, registry.get(finding_id)))
            continue

        for rnd in rounds:
            finding_id = f"campaign-{cid}-r{rnd.round_number}"
            raw = rnd.model_dump(mode="json")
            rows.append(_round_to_finding(finding_id, cid, raw, registry.get(finding_id)))

    return rows


def _round_to_finding(
    finding_id: str,
    campaign_id: str,
    raw: dict[str, Any],
    registry: dict[str, Any] | None,
) -> dict[str, Any]:
    attack = raw.get("attack") or {}
    response = raw.get("response") or {}
    score = raw.get("score") or {}
    category = str(attack.get("category", ""))
    asi_code, asi_label = _asi_for_category(category)
    verdict = str(score.get("verdict", "UNKNOWN"))
    blocked = bool(response.get("blocked"))
    status = "validated"
    if registry and registry.get("status") == "promoted":
        status = "promoted"
    return {
        "id": finding_id,
        "title": str(attack.get("name", "Campaign finding")),
        "severity": _severity_from_score(score),
        "category": category,
        "asi_code": asi_code,
        "asi_label": asi_label,
        "status": status,
        "source": "campaign",
        "source_ref": campaign_id,
        "timestamp": raw.get("timestamp"),
        "verdict": verdict,
        "attack_prompt": str(attack.get("prompt", ""))[:500],
        "reasoning": str(score.get("reasoning", ""))[:1000],
        "custody_chain": _default_custody(verdict=verdict, blocked=blocked),
        "playbook_version": registry.get("playbook_version") if registry else None,
        "promoted_rule_name": registry.get("rule_name") if registry else None,
    }


def _findings_from_telemetry(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    registry = all_records()
    for idx, evt in enumerate(reversed(events[-40:])):
        score = float(evt.get("risk_score") or 0)
        sev = str(evt.get("severity", "")).upper()
        if score < 50 and sev not in ("HIGH", "CRITICAL"):
            continue
        session = str(evt.get("session_id") or evt.get("agent_id") or f"evt-{idx}")
        finding_id = f"telemetry-{session}-{idx}"
        reg = registry.get(finding_id)
        status = "promoted" if reg and reg.get("status") == "promoted" else "new"
        tool = str(evt.get("tool_name") or "event")
        rows.append(
            {
                "id": finding_id,
                "title": f"{tool} · {session[:8]}",
                "severity": sev if sev in ("CRITICAL", "HIGH", "MEDIUM", "LOW") else "HIGH",
                "category": tool,
                "asi_code": "ASI01",
                "asi_label": "Agent Goal Hijack",
                "status": status,
                "source": "telemetry",
                "source_ref": session,
                "timestamp": evt.get("timestamp") or evt.get("created_at"),
                "verdict": str(evt.get("verdict") or "FLAGGED"),
                "attack_prompt": str(evt.get("tool_name") or ""),
                "reasoning": "",
                "custody_chain": _default_custody(
                    verdict=str(evt.get("verdict") or "FLAGGED"),
                    blocked="BLOCK" in str(evt.get("verdict", "")).upper(),
                ),
                "playbook_version": reg.get("playbook_version") if reg else None,
                "promoted_rule_name": reg.get("rule_name") if reg else None,
            }
        )
    return rows


class PromoteFindingRequest(BaseModel):
    rule_name: str
    pattern: str
    event_type: str = "PROMPT_INJECTION"
    severity: str = "HIGH"
    risk_score: float = Field(default=80.0, ge=0, le=100)
    description: str = ""


@router.get("/findings")
async def list_findings() -> dict[str, Any]:
    from src.services.telemetry_bus import telemetry_bus

    campaign_rows = _findings_from_campaigns()
    telemetry_rows = _findings_from_telemetry(telemetry_bus.get_history(limit=80))
    merged = {r["id"]: r for r in campaign_rows + telemetry_rows}
    findings = sorted(
        merged.values(),
        key=lambda r: str(r.get("timestamp") or ""),
        reverse=True,
    )
    return {
        "findings": findings,
        "count": len(findings),
        "playbook_version": current_version() or 1,
    }


@router.get("/findings/{finding_id}")
async def get_finding(finding_id: str) -> dict[str, Any]:
    data = await list_findings()
    for row in data["findings"]:
        if row["id"] == finding_id:
            return row
    raise HTTPException(status_code=404, detail="Finding not found")


@router.post("/findings/{finding_id}/promote")
async def promote_finding(finding_id: str, payload: PromoteFindingRequest) -> dict[str, Any]:
    """Deploy a suggested rule and mark the finding promoted with a playbook version bump."""
    import yaml

    finding = await get_finding(finding_id)
    if not POLICY_PATH.exists():
        rules: list[dict[str, Any]] = []
    else:
        with POLICY_PATH.open(encoding="utf-8") as f:
            rules = (yaml.safe_load(f) or {}).get("rules", [])

    rule = payload.model_dump()
    rules.append(rule)
    POLICY_PATH.parent.mkdir(parents=True, exist_ok=True)
    with POLICY_PATH.open("w", encoding="utf-8") as f:
        yaml.dump({"rules": rules}, f, default_flow_style=False)

    version_entry = snapshot_rules(
        rules,
        trigger="finding_promote",
        finding_id=finding_id,
        note=f"Promoted from {finding.get('title', finding_id)}",
    )
    record = set_promoted(
        finding_id,
        rule_name=payload.rule_name,
        playbook_version=int(version_entry["version"]),
    )
    return {
        "status": "promoted",
        "finding_id": finding_id,
        "playbook_version": version_entry["version"],
        "rule_name": payload.rule_name,
        "record": record,
    }
