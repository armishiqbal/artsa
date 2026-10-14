"""Dashboard metrics API — live severity counts and risk trends."""

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Query

from src.api.dependencies import get_current_tenant, get_session_tracker
from src.core.asi import HMAC_STATUS, HMAC_THREAT_CODE, asi_catalog
from src.services.ops_telemetry import build_ops_snapshot
from src.services.session_tracker import SessionTracker
from src.services.telemetry_bus import telemetry_bus

router = APIRouter(tags=["Metrics"])

@router.get("/metrics/dashboard")
async def get_dashboard_metrics(
    tracker: SessionTracker = Depends(get_session_tracker),
) -> dict[str, Any]:
    """Return live command-center metrics from telemetry bus and active sessions."""
    severity = telemetry_bus.get_severity_counts()
    sessions = list(tracker.active_sessions.values())
    history = telemetry_bus.get_history(limit=200)

    breached = sum(1 for s in sessions if s.status == "BREACHED")
    high_risk = sum(1 for s in sessions if s.max_risk_score >= 70 and s.status != "BREACHED")
    medium_risk = sum(1 for s in sessions if 40 <= s.max_risk_score < 70)
    low_risk = sum(1 for s in sessions if s.max_risk_score < 40 and s.status == "ACTIVE")

    risk_trend = telemetry_bus.get_risk_trend(limit=24)
    avg_risk = sum(p["risk_score"] for p in risk_trend) / len(risk_trend) if risk_trend else None
    max_risk = max((p["risk_score"] for p in risk_trend), default=None)

    active_count = sum(1 for s in sessions if getattr(s, "status", None) == "ACTIVE")

    # Detector fires and verdict labels do not provide a judged denominator or
    # proof that an action was enforced. Report no effectiveness score until a
    # campaign evaluation supplies that evidence.
    defense_layers: dict[str, float] = {}
    defense_score = None

    # Compute event rate (events per minute) for sparkline context
    event_rate = 0.0
    recent_events = [e for e in history if e.get("timestamp")]
    if len(recent_events) >= 2:
        try:
            first_ts = datetime.fromisoformat(str(recent_events[0]["timestamp"]))
            last_ts = datetime.fromisoformat(str(recent_events[-1]["timestamp"]))
            delta_minutes = max((last_ts - first_ts).total_seconds() / 60.0, 0.1)
            event_rate = round(len(recent_events) / delta_minutes, 1)
        except (ValueError, KeyError):
            event_rate = 0.0

    return {
        "severity_counts": {
            "CRITICAL": max(severity.get("CRITICAL", 0), breached),
            "HIGH": max(severity.get("HIGH", 0), high_risk),
            "MEDIUM": max(severity.get("MEDIUM", 0), medium_risk),
            "LOW": max(severity.get("LOW", 0), low_risk),
        },
        "active_sessions": max(0, active_count),
        "defense_layers": defense_layers,
        "defense_score": defense_score,
        "risk_trend": risk_trend,
        "risk_score_count": len(risk_trend),
        "avg_risk_score": round(avg_risk, 1) if avg_risk is not None else None,
        "max_risk_score": round(max_risk, 1) if risk_trend else None,
        "event_rate": event_rate,
        "total_events": len(history),
    }


@router.get("/telemetry/recent")
async def recent_telemetry(limit: int = Query(50, ge=1, le=200)) -> dict[str, Any]:
    """Recent ingest/proxy telemetry for dashboards when WebSocket history is empty."""
    events = telemetry_bus.get_history(limit=limit)
    return {"events": events, "count": len(events)}


@router.get("/telemetry/ops")
async def ops_telemetry(tenant_id: str = Depends(get_current_tenant)) -> dict[str, Any]:
    """Canonical Command Center snapshot projected from ingest + campaign buses.

    Does not invent LIVE/HMAC/ASI08. Prefer this over polling each component.
    """
    return build_ops_snapshot(tenant_id=tenant_id)


@router.get("/taxonomy/asi")
async def asi_taxonomy() -> dict[str, Any]:
    """OWASP ASI01–ASI10 with honest detector coverage and ASI08 breaker status."""
    return {
        "catalog": asi_catalog(),
        "hmac": {
            "threat_code": HMAC_THREAT_CODE,
            "status": HMAC_STATUS.value,
            "note": "Campaign Manager starts Research; campaign agent handoffs are receiver-verified. Defender is conditional. WS tickets use a separate secret.",
        },
    }
