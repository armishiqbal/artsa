"""Agentic Risk Framework API — OWASP-style Agentic AI Top 10 mapped to live telemetry."""

from __future__ import annotations

from fastapi import APIRouter

from src.core.models.risks import RiskFrameworkResponse
from src.core.severity import severity_from_score
from src.data.agentic_risk_framework import load_risk_framework
from src.services.telemetry_bus import telemetry_bus

router = APIRouter(tags=["Risks"])


def _event_flags(evt: dict) -> set[str]:
    raw = evt.get("flags", []) or []
    return {str(f).upper() for f in raw}


def _verdict(evt: dict) -> str:
    return str(evt.get("verdict", "")).upper()


@router.get("/risks", response_model=RiskFrameworkResponse)
async def get_risk_framework() -> RiskFrameworkResponse:
    """Return the Agentic AI Top 10 with live telemetry counts from the telemetry bus."""
    history = telemetry_bus.get_history(limit=500)
    framework_def = load_risk_framework()

    rows: list[dict] = []
    for risk in framework_def:
        risk_flags = {str(f).upper() for f in risk["flags"]}
        matched = [evt for evt in history if risk_flags.intersection(_event_flags(evt))]
        blocked = [evt for evt in matched if _verdict(evt) == "BLOCKED"]
        breached = [evt for evt in matched if _verdict(evt) == "BREACHED"]
        scores = [float(evt.get("risk_score", 0.0)) for evt in matched]
        max_risk = max(scores) if scores else 0.0

        rows.append(
            {
                "id": risk["id"],
                "rank": risk["rank"],
                "name": risk["name"],
                "description": risk["description"],
                "attack_categories": risk["attack_categories"],
                "defense_layers": risk["defense_layers"],
                "detectors": risk["detectors"],
                "mitigations": risk["mitigations"],
                "live_events": len(matched),
                "blocked_events": len(blocked),
                "breached_events": len(breached),
                "max_risk_score": round(max_risk, 1),
                "severity": severity_from_score(max_risk),
            }
        )

    generated_at = history[-1].get("timestamp") if history else None

    return RiskFrameworkResponse(
        framework=rows,
        total_events=len(history),
        generated_at=generated_at,
    )
