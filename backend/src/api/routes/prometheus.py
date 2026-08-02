"""Prometheus metrics exposition endpoint."""

from fastapi import APIRouter, Depends, Response

from src.api.dependencies import get_session_tracker
from src.services.prometheus_metrics import render_prometheus
from src.services.session_tracker import SessionTracker
from src.services.telemetry_bus import telemetry_bus

router = APIRouter(tags=["Metrics"])


@router.get("/metrics/prometheus")
async def prometheus_metrics(
    tracker: SessionTracker = Depends(get_session_tracker),
) -> Response:
    """Prometheus text exposition format for scraping."""
    sessions = len(tracker.active_sessions)
    severity = telemetry_bus.get_severity_counts()
    body = render_prometheus(active_sessions=sessions, severity=severity)
    return Response(content=body, media_type="text/plain; version=0.0.4; charset=utf-8")
