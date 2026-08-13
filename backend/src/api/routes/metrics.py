"""Dashboard metrics API — live severity counts and risk trends."""

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends

from src.api.dependencies import get_session_tracker
from src.services.session_tracker import SessionTracker
from src.services.telemetry_bus import telemetry_bus

router = APIRouter(tags=["Metrics"])

# Real detector names mapped to defense layers. The previous map keyed on
# invented detector names ("tool_sandbox_detector", "behavioral_baseline_…")
# that matched nothing, so every layer fell through to the constant 100.0.
# WORKPACKAGE B (B4): keys are the actual detector `name` attributes.
DETECTOR_LAYER_MAP = {
    "rulebaseddetector": "rule_inspector",
    "promptinjectiondetector": "tool_validator",
    "semanticdetector": "semantic_inspector",
    "statisticaldetector": "statistical_inspector",
    "goaldriftdetector": "goal_drift_classifier",
    "trajectorydetector": "trajectory_monitor",
    "tooloutputscanner": "tool_output_inspector",
    "sqlinjectiondetector": "sql_injection_guard",
    "mcpsdestructivetooldetector": "mcp_destructive_guard",
    "canarytokendetector": "canary_net",
}

# Order of layers as reported (display order for the dashboard).
_LAYER_ORDER = (
    "tool_validator",
    "rule_inspector",
    "semantic_inspector",
    "statistical_inspector",
    "goal_drift_classifier",
    "trajectory_monitor",
    "tool_output_inspector",
    "sql_injection_guard",
    "mcp_destructive_guard",
    "canary_net",
)


def _compute_defense_layers(history: list[dict[str, Any]]) -> dict[str, float]:
    """Derive measured defense-layer effectiveness from telemetry history.

    For each layer, the value is the ratio of events that the layer fired on
    *and* the session was actually contained (SUSPICIOUS/BREACHED) to all
    events the layer fired on — i.e. measured catch-rate. Layers with no
    attributed telemetry report 0.0, never a fabricated 100.0.
    """
    layer_totals: dict[str, int] = {}
    layer_catches: dict[str, int] = {}
    for layer in _LAYER_ORDER:
        layer_totals[layer] = 0
        layer_catches[layer] = 0

    for event in history:
        verdict = str(event.get("verdict", "")).upper()
        contained = "SUSPICIOUS" in verdict or "BREACH" in verdict or "BLOCK" in verdict
        detectors = event.get("detectors")
        if detectors is None:
            sec_events = event.get("security_events")
            detectors = [d.get("detector") for d in sec_events] if isinstance(sec_events, list) else None
        if not isinstance(detectors, list):
            continue

        fired_layers: set[str] = set()
        for detector in detectors:
            layer = DETECTOR_LAYER_MAP.get(str(detector).lower())
            if layer:
                fired_layers.add(layer)
        for layer in fired_layers:
            layer_totals[layer] += 1
            if contained:
                layer_catches[layer] += 1

    result: dict[str, float] = {}
    for layer in _LAYER_ORDER:
        total = layer_totals[layer]
        if total > 0:
            result[layer] = round((layer_catches[layer] / total) * 100.0, 1)
        else:
            result[layer] = 0.0

    return result


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
    avg_risk = (
        sum(p["risk_score"] for p in risk_trend) / len(risk_trend) if risk_trend else 0.0
    )
    max_risk = max((p["risk_score"] for p in risk_trend), default=0.0)

    active_count = sum(1 for s in sessions if getattr(s, "status", None) == "ACTIVE")
    if active_count == 0 and sessions:
        active_count = len(sessions)

    defense_layers = _compute_defense_layers(history)
    layer_values = list(defense_layers.values())
    defense_score = round(
        (sum(layer_values) / len(layer_values)) - min(avg_risk / 10, 15), 1
    ) if layer_values else 100.0

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
        "avg_risk_score": round(avg_risk, 1),
        "max_risk_score": round(max_risk, 1),
        "event_rate": event_rate,
        "total_events": len(history),
    }
