"""Event Ingestion Pipeline Endpoint."""

import logging
import time
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.dependencies import (
    get_current_tenant,
    get_db,
    get_event_processor,
    get_redis,
    get_session_tracker,
    rate_limit_dependency,
)
from src.core.config import settings
from src.core.models.events import ToolCallEvent
from src.core.models.ingest import IngestResponse
from src.core.models.sessions import Session
from src.core.severity import severity_from_score
from src.data import memory_store
from src.data.repositories.evaluations import EvaluationRepository
from src.data.repositories.events import EventRepository
from src.data.repositories.sessions import SessionRepository
from src.services.alert_store import persist_alert, record_alert_from_evaluation
from src.services.event_processor import EventProcessor
from src.services.session_tracker import SessionTracker
from src.services.telemetry_bus import telemetry_bus

router = APIRouter(tags=["Ingestion"])

_CONTAINED_STATUSES = frozenset({"BREACHED", "QUARANTINED", "CLOSED"})
_ENFORCE_ACTIONS = frozenset({"KILL", "QUARANTINE"})

logger = logging.getLogger(__name__)

# Set once so a misconfigured Celery stack is reported loudly but not spammed
# on every ingested event.
_celery_import_warned = False


def _maybe_enqueue_celery(event: ToolCallEvent) -> None:
    global _celery_import_warned
    if not settings.USE_CELERY:
        return
    try:
        from src.workers.tasks.process_events import process_tool_call_event

        _celery_import_warned = False
        process_tool_call_event.delay(event.model_dump(mode="json"))
    except ImportError as exc:
        if not _celery_import_warned:
            _celery_import_warned = True
            logger.warning(
                "USE_CELERY=true but the Celery worker stack is not importable (%s). "
                "Events will be processed synchronously instead. Install 'celery' "
                "(e.g. `pip install celery`) and ensure src.workers is on the path "
                "to enable async enqueue.",
                exc,
            )
    except Exception as exc:
        logger.debug("Celery enqueue skipped: %s", exc)


@router.post("/ingest", status_code=status.HTTP_201_CREATED, response_model=IngestResponse)
async def ingest_events(
    payload: ToolCallEvent | list[ToolCallEvent],
    tenant_id: str = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
    processor: EventProcessor = Depends(get_event_processor),
    tracker: SessionTracker = Depends(get_session_tracker),
    _: None = Depends(rate_limit_dependency),
) -> dict[str, Any]:
    """Ingest tool call event(s), evaluate risk, and return verdicts for enforcement."""
    ingest_start = time.perf_counter()
    events: list[ToolCallEvent] = payload if isinstance(payload, list) else [payload]

    if not events:
        raise HTTPException(status_code=400, detail="Empty event payload")

    event_repo = EventRepository(db)
    session_repo = SessionRepository(db)
    eval_repo = EvaluationRepository(db)

    # Fail closed: reject tool calls for already contained sessions
    if settings.ARTSA_BLOCK_CONTAINED_SESSIONS:
        for event in events:
            existing = tracker.get_session(event.session_id) or memory_store.get_session(event.session_id)
            if existing and existing.status in _CONTAINED_STATUSES:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={
                        "message": "Session is contained — further tool calls rejected",
                        "session_id": str(event.session_id),
                        "session_status": existing.status,
                    },
                )

    await event_repo.bulk_insert(events)

    evaluations: list[dict[str, Any]] = []
    auto_enforced: str | None = None
    session_status: str | None = None
    # Batched hot path: Redis stream entries and DB mutations are deferred and
    # flushed once, so a batch of N events costs ~1 Redis round-trip and 1 DB
    # commit instead of ~N each. Repo calls run with commit=False inside the
    # loop; the single commit below persists the whole batch transactionally.
    redis_entries: list[dict[str, Any]] = []

    for event in events:
        redis_entries.append({
            "id": str(event.id),
            "session_id": str(event.session_id),
            "agent_id": event.agent_id,
            "tool_name": event.tool_name,
            "arguments": str(event.arguments),
        })

        if not tracker.get_session(event.session_id):
            session = Session(id=event.session_id, agent_id=event.agent_id, tenant_id=tenant_id)
            tracker.active_sessions[str(event.session_id)] = session
            tracker.session_events[str(event.session_id)] = []
            memory_store.store_session(session)
            await session_repo.create_session(session, commit=False)

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
            commit=False,
        )
        memory_store.update_session_risk(
            event.session_id,
            risk_score.overall_score,
            breached=verdict.verdict == "BREACHED",
        )

        enforced = False
        action = verdict.recommended_action
        if settings.ARTSA_AUTO_ENFORCE and action in _ENFORCE_ACTIONS:
            tracker.apply_action(event.session_id, action)
            await session_repo.apply_action(event.session_id, action, commit=False)
            enforced = True
            auto_enforced = action

        evaluation = {
            "event_id": str(event.id),
            "tool_name": event.tool_name,
            "risk_score": risk_score.overall_score,
            "verdict": verdict.verdict,
            "confidence": verdict.confidence,
            "recommended_action": verdict.recommended_action,
            "reasoning": verdict.reasoning,
            "flags": risk_score.flags,
            "rule_based_score": risk_score.rule_based_score,
            "statistical_score": risk_score.statistical_score,
            "semantic_score": risk_score.semantic_score,
            "goal_drift_score": risk_score.goal_drift_score,
            "injection_score": risk_score.injection_score,
            "trajectory_score": risk_score.trajectory_score,
            "tool_output_score": risk_score.tool_output_score,
            "canary_score": risk_score.canary_score,
            "sql_injection_score": risk_score.sql_injection_score,
            "mcp_destructive_score": risk_score.mcp_destructive_score,
            "policy_score": risk_score.policy_score,
            "bypass_depth": risk_score.bypass_depth,
            "security_event_count": len(sec_events),
            "enforced": enforced,
        }
        await eval_repo.upsert(str(event.id), event.session_id, evaluation, commit=False)
        evaluations.append(evaluation)

        # Optional MongoDB sink: persist the verdict doc (no-op without URI).
        try:
            from datetime import UTC as _UTC

            from src.services.mongo_sink import mongo_sink

            mongo_sink.enqueue_evaluation(
                {
                    **evaluation,
                    "session_id": str(event.session_id),
                    "agent_id": event.agent_id,
                    "ts": datetime.now(_UTC).isoformat(),
                }
            )
        except Exception as exc:  # pragma: no cover - sink must never break ingest
            logger.debug("MongoDB evaluation enqueue skipped: %s", exc)

        _maybe_enqueue_celery(event)

        severity = severity_from_score(risk_score.overall_score)
        sess = tracker.get_session(event.session_id)
        session_status = sess.status if sess else session_status

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
                "detectors": [e.detector for e in sec_events],
                "security_events": [
                    {"detector": e.detector, "risk_score": e.risk_score, "severity": e.severity}
                    for e in sec_events
                ],
                "enforced": enforced,
                "session_status": session_status,
            }
        )

        alert = record_alert_from_evaluation(
            session_id=event.session_id,
            agent_id=event.agent_id,
            tool_name=event.tool_name,
            risk_score=risk_score.overall_score,
            verdict=verdict.verdict,
            recommended_action=verdict.recommended_action,
        )
        if alert is not None:
            await persist_alert(db, alert, commit=False)

    # Flush the deferred batch: one Redis pipeline round-trip + one DB commit.
    if redis_entries:
        redis.xadd_many("events:incoming", redis_entries)
    await db.commit()

    first_event = events[0]
    first_eval = evaluations[0]
    from src.services.prometheus_metrics import record_ingest

    record_ingest((time.perf_counter() - ingest_start) * 1000)
    return {
        "ingested": len(events),
        "session_id": str(first_event.session_id),
        "timestamp": datetime.now(UTC).isoformat(),
        "risk_score": {"overall_score": first_eval["risk_score"], "flags": first_eval["flags"]},
        "verdict": {
            "verdict": first_eval["verdict"],
            "confidence": first_eval["confidence"],
            "recommended_action": first_eval["recommended_action"],
            "reasoning": first_eval["reasoning"],
        },
        "evaluations": evaluations,
        "session_status": session_status,
        "auto_enforced_action": auto_enforced,
    }
