"""Event Ingestion Pipeline Endpoint."""

import time
from datetime import datetime, timezone
from typing import List, Union, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.dependencies import get_current_tenant, get_db, get_redis, get_event_processor, get_session_tracker, rate_limit_dependency
from src.core.models.events import ToolCallEvent
from src.core.models.sessions import Session
from src.data import memory_store
from src.data.repositories.evaluations import EvaluationRepository
from src.data.repositories.events import EventRepository
from src.data.repositories.sessions import SessionRepository
from src.services.event_processor import EventProcessor
from src.services.session_tracker import SessionTracker
from src.core.config import settings
from src.services.alert_store import record_alert_from_evaluation
from src.services.telemetry_bus import telemetry_bus

router = APIRouter(tags=["Ingestion"])


def _maybe_enqueue_celery(event: ToolCallEvent) -> None:
    if not settings.USE_CELERY:
        return
    try:
        from src.workers.tasks.process_events import process_tool_call_event

        process_tool_call_event.delay(event.model_dump(mode="json"))
    except Exception as exc:
        import logging

        logging.getLogger(__name__).debug("Celery enqueue skipped: %s", exc)


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
    ingest_start = time.perf_counter()
    events: List[ToolCallEvent] = payload if isinstance(payload, list) else [payload]

    if not events:
        raise HTTPException(status_code=400, detail="Empty event payload")

    event_repo = EventRepository(db)
    session_repo = SessionRepository(db)
    eval_repo = EvaluationRepository(db)
    await event_repo.bulk_insert(events)

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
            session = Session(id=event.session_id, agent_id=event.agent_id, tenant_id=tenant_id)
            tracker.active_sessions[str(event.session_id)] = session
            tracker.session_events[str(event.session_id)] = []
            memory_store.store_session(session)
            await session_repo.create_session(session)

        tracker.add_event_to_session(event.session_id, event)
        risk_score, verdict, sec_events = processor.process(event)
        tracker.update_session(
            session_id=event.session_id,
            risk_score=risk_score.overall_score,
            is_breached=verdict.verdict == "BREACHED",
        )
        await session_repo.update_risk_score(
            event.session_id,
            risk_score.overall_score,
            breached=verdict.verdict == "BREACHED",
        )
        memory_store.update_session_risk(
            event.session_id,
            risk_score.overall_score,
            breached=verdict.verdict == "BREACHED",
        )

        evaluation = {
            "risk_score": risk_score.overall_score,
            "verdict": verdict.verdict,
            "confidence": verdict.confidence,
            "recommended_action": verdict.recommended_action,
            "flags": risk_score.flags,
            "rule_based_score": risk_score.rule_based_score,
            "statistical_score": risk_score.statistical_score,
            "semantic_score": risk_score.semantic_score,
            "goal_drift_score": risk_score.goal_drift_score,
            "bypass_depth": risk_score.bypass_depth,
            "security_event_count": len(sec_events),
        }
        await eval_repo.upsert(str(event.id), event.session_id, evaluation)

        _maybe_enqueue_celery(event)

        severity = "LOW"
        if risk_score.overall_score >= 80:
            severity = "CRITICAL"
        elif risk_score.overall_score >= 60:
            severity = "HIGH"
        elif risk_score.overall_score >= 40:
            severity = "MEDIUM"

        telemetry_bus.publish(
            {
                "type": "tool_call",
                "session_id": str(event.session_id),
                "agent_id": event.agent_id,
                "tool_name": event.tool_name,
                "risk_score": risk_score.overall_score,
                "verdict": verdict.verdict,
                "confidence": verdict.confidence,
                "action": verdict.recommended_action,
                "severity": severity,
                "flags": risk_score.flags,
                "security_event_count": len(sec_events),
            }
        )

        record_alert_from_evaluation(
            session_id=event.session_id,
            agent_id=event.agent_id,
            tool_name=event.tool_name,
            risk_score=risk_score.overall_score,
            verdict=verdict.verdict,
            recommended_action=verdict.recommended_action,
        )

    first_event = events[0]
    from src.services.prometheus_metrics import record_ingest

    record_ingest((time.perf_counter() - ingest_start) * 1000)
    return {
        "ingested": len(events),
        "session_id": str(first_event.session_id),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
