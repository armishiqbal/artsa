"""Event Ingestion Pipeline Endpoint."""

from datetime import datetime, timezone
from typing import List, Union, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.dependencies import get_current_tenant, get_db, get_redis, get_event_processor, get_session_tracker, rate_limit_dependency
from src.core.models.events import ToolCallEvent
from src.data.repositories.events import EventRepository
from src.services.event_processor import EventProcessor
from src.services.session_tracker import SessionTracker

router = APIRouter(tags=["Ingestion"])


@router.post("/ingest", status_code=status.HTTP_201_CREATED)
async def ingest_events(
    payload: Union[ToolCallEvent, List[ToolCallEvent]],
    tenant_id: str = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
    processor: EventProcessor = Depends(get_event_processor),
    tracker: SessionTracker = Depends(get_session_tracker),
    _: None = Depends(rate_limit_dependency),
) -> Dict[str, Any]:
    """Ingest tool call event(s), write to database, publish to Redis stream, and evaluate risk."""
    events: List[ToolCallEvent] = payload if isinstance(payload, list) else [payload]

    if not events:
        raise HTTPException(status_code=400, detail="Empty event payload")

    repo = EventRepository(db)
    await repo.bulk_insert(events)

    # Publish each event to Redis Stream "events:incoming" and update session tracker
    for event in events:
        redis.xadd("events:incoming", {
            "id": str(event.id),
            "session_id": str(event.session_id),
            "agent_id": event.agent_id,
            "tool_name": event.tool_name,
            "arguments": str(event.arguments),
        })
        
        # Ensure session exists in tracker
        if not tracker.get_session(event.session_id):
            tracker.start_session(agent_id=event.agent_id, tenant_id=tenant_id)
            # Override generated ID with event.session_id
            session = list(tracker.active_sessions.values())[-1]
            tracker.active_sessions[str(event.session_id)] = session
            session.id = event.session_id

        tracker.add_event_to_session(event.session_id, event)
        risk_score, verdict, sec_events = processor.process(event)
        tracker.update_session(
            session_id=event.session_id,
            risk_score=risk_score.overall_score,
            is_breached=verdict.verdict == "BREACHED",
        )

    first_event = events[0]
    return {
        "ingested": len(events),
        "session_id": str(first_event.session_id),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
