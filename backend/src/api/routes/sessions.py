"""Sessions Management and Telemetry Stream Endpoints."""

import json
import logging
import uuid
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.dependencies import get_current_tenant, get_db, get_session_tracker
from src.api.ws_auth import require_ws_auth
from src.core.models.events import ToolCallEvent
from src.core.models.sessions import Session
from src.data import memory_store
from src.data.repositories.evaluations import EvaluationRepository
from src.data.repositories.events import EventRepository
from src.data.repositories.sessions import SessionRepository
from src.services.session_tracker import SessionTracker
from src.services.telemetry_bus import telemetry_bus

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Sessions"])


class SessionActionRequest(BaseModel):
    action: Literal["KILL", "QUARANTINE", "THROTTLE", "ALERT"] = Field(
        ..., description="Action to enforce on agent session"
    )


class TimelineEntry(BaseModel):
    event: ToolCallEvent
    evaluation: Optional[Dict[str, Any]] = None


@router.get("/sessions", response_model=List[Session])
async def list_sessions(
    tenant_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    tracker: SessionTracker = Depends(get_session_tracker),
    current_tenant: str = Depends(get_current_tenant),
):
    """List agent sessions filtered by tenant_id and status."""
    effective_tenant = tenant_id or current_tenant
    active = list(tracker.active_sessions.values())
    if effective_tenant:
        active = [s for s in active if s.tenant_id == effective_tenant]
    if status:
        active = [s for s in active if s.status == status]
    if active:
        return active[offset : offset + limit]

    repo = SessionRepository(db)
    return await repo.list_sessions(tenant_id=effective_tenant, status=status, limit=limit, offset=offset)


@router.get("/sessions/{session_id}", response_model=Session)
async def get_session_details(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    tracker: SessionTracker = Depends(get_session_tracker),
):
    """Fetch details for a specific session by UUID."""
    session = tracker.get_session(session_id)
    if not session:
        repo = SessionRepository(db)
        session = await repo.get_session(session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Session {session_id} not found")
    return session


@router.get("/sessions/{session_id}/timeline", response_model=List[TimelineEntry])
async def get_session_timeline(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    tracker: SessionTracker = Depends(get_session_tracker),
):
    """Return tool call events with containment evaluations ordered by timestamp."""
    event_repo = EventRepository(db)
    eval_repo = EvaluationRepository(db)

    tracked_events = tracker.session_events.get(str(session_id), [])
    events = tracked_events if tracked_events else await event_repo.get_by_session(session_id)
    events = sorted(events, key=lambda e: e.timestamp)

    evaluations = await eval_repo.get_by_session(session_id)

    return [
        TimelineEntry(
            event=evt,
            evaluation=evaluations.get(str(evt.id)),
        )
        for evt in events
    ]


@router.post("/sessions/{session_id}/action")
async def enforce_session_action(
    session_id: uuid.UUID,
    payload: SessionActionRequest,
    db: AsyncSession = Depends(get_db),
    tracker: SessionTracker = Depends(get_session_tracker),
):
    """Enforce a containment action (KILL, THROTTLE, QUARANTINE) on an active session."""
    session = tracker.get_session(session_id) or memory_store.get_session(session_id)
    if not session:
        repo = SessionRepository(db)
        session = await repo.get_session(session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Session {session_id} not found")

    # Ensure tracker has the session for in-memory follow-up ingest checks
    if not tracker.get_session(session_id):
        tracker.active_sessions[str(session_id)] = session

    tracker.apply_action(session_id, payload.action)
    repo = SessionRepository(db)
    updated = await repo.apply_action(session_id, payload.action)
    final = updated or tracker.get_session(session_id) or session

    telemetry_bus.publish(
        {
            "type": "session_action",
            "session_id": str(session_id),
            "agent_id": final.agent_id,
            "action": payload.action,
            "session_status": final.status,
            "risk_score": final.max_risk_score,
            "verdict": "BREACHED" if payload.action == "KILL" else "SUSPICIOUS",
            "severity": "CRITICAL" if payload.action == "KILL" else "HIGH",
            "flags": ["manual_containment"],
        }
    )

    logger.info("Enforced action %s on session %s → %s", payload.action, session_id, final.status)

    return {
        "session_id": str(session_id),
        "enforced_action": payload.action,
        "status": final.status,
    }


@router.websocket("/sessions/{session_id}/stream")
async def session_websocket_stream(websocket: WebSocket, session_id: uuid.UUID):
    """Live WebSocket telemetry stream for a specific session."""
    if await require_ws_auth(websocket) is None:
        return

    await websocket.accept()
    logger.info("WebSocket connected for session stream %s", session_id)
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(
                json.dumps(
                    {
                        "session_id": str(session_id),
                        "event": "TELEMETRY_ACK",
                        "received": data,
                    }
                )
            )
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected for session stream %s", session_id)
