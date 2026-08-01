"""Event Ingestion Route."""

from fastapi import APIRouter, Depends
from src.api.dependencies import get_event_processor, get_session_tracker
from src.core.models.events import ToolCallEvent
from src.services.event_processor import EventProcessor
from src.services.session_tracker import SessionTracker

router = APIRouter(tags=["Ingestion"])


@router.post("/ingest")
async def ingest_tool_call(
    event: ToolCallEvent,
    processor: EventProcessor = Depends(get_event_processor),
    tracker: SessionTracker = Depends(get_session_tracker),
):
    """Ingest a tool call event for real-time containment risk inspection."""
    risk_score, verdict, security_events = processor.process(event)
    tracker.update_session(
        session_id=event.session_id,
        risk_score=risk_score.overall_score,
        is_breached=verdict.verdict == "BREACHED",
    )
    return {
        "risk_score": risk_score,
        "verdict": verdict,
        "security_events": security_events,
    }
