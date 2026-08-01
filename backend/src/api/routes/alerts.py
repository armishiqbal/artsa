"""Alerts Route."""

import uuid
from typing import List
from fastapi import APIRouter
from src.core.models.alerts import Alert

router = APIRouter(tags=["Alerts"])

_mock_alerts = [
    Alert(
        id=uuid.uuid4(),
        session_id=uuid.uuid4(),
        agent_id="agent-exec-03",
        severity="CRITICAL",
        title="Sandbox Escape Attempt Intercepted",
        message="Destructive shell command execution blocked by EDS engine",
        channel="SLACK",
        delivered=True,
    ),
    Alert(
        id=uuid.uuid4(),
        session_id=uuid.uuid4(),
        agent_id="agent-sql-02",
        severity="HIGH",
        title="Credential Harvesting Attempt",
        message="Sensitive file access to /etc/passwd detected",
        channel="WEBHOOK",
        delivered=True,
    ),
]


@router.get("/alerts", response_model=List[Alert])
async def list_alerts():
    """List recent security alerts."""
    return _mock_alerts
