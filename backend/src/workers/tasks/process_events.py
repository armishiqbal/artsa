"""Celery async task consuming Redis stream events."""

import json
import logging
from typing import Any, Dict
from src.core.models.events import ToolCallEvent
from src.services.event_processor import EventProcessor
from src.workers.celery_app import celery_app

logger = logging.getLogger(__name__)
_processor = EventProcessor()


@celery_app.task(name="tasks.process_tool_call_event")
def process_tool_call_event(event_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Process incoming Redis Stream tool call event."""
    try:
        event = ToolCallEvent(**event_dict)
        risk_score, verdict, sec_events = _processor.process_event(event)

        if sec_events:
            logger.warning("Containment risk detected by Celery worker: %s", verdict.reasoning)

        return {
            "session_id": str(event.session_id),
            "risk_score": risk_score.overall_score,
            "verdict": verdict.verdict,
            "detected_events": len(sec_events),
        }
    except Exception as err:
        logger.error("Error processing stream event in Celery task: %s", err)
        return {"error": str(err)}
