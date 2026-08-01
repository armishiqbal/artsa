"""Sessions Management Route."""

import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from src.api.dependencies import get_session_tracker
from src.core.models.sessions import Session
from src.services.session_tracker import SessionTracker

router = APIRouter(tags=["Sessions"])


@router.post("/sessions", response_model=Session)
async def create_session(
    agent_id: str,
    tenant_id: str = "default_tenant",
    tracker: SessionTracker = Depends(get_session_tracker),
):
    """Start a new agent containment monitoring session."""
    return tracker.start_session(agent_id=agent_id, tenant_id=tenant_id)


@router.get("/sessions/{session_id}", response_model=Session)
async def get_session_by_id(
    session_id: uuid.UUID,
    tracker: SessionTracker = Depends(get_session_tracker),
):
    """Fetch session details by UUID."""
    session = tracker.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session
