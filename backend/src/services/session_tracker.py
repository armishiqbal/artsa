"""Session Tracker Service."""

import uuid
from datetime import datetime, timezone
from typing import Dict, Optional
from src.core.models.sessions import Session


class SessionTracker:
    """Tracks active agent execution sessions."""

    def __init__(self) -> None:
        self.active_sessions: Dict[uuid.UUID, Session] = {}

    def start_session(self, agent_id: str, tenant_id: str = "default_tenant") -> Session:
        """Initialize a new agent execution session."""
        session = Session(agent_id=agent_id, tenant_id=tenant_id, status="ACTIVE")
        self.active_sessions[session.id] = session
        return session

    def get_session(self, session_id: uuid.UUID) -> Optional[Session]:
        """Fetch session by ID."""
        return self.active_sessions.get(session_id)

    def update_session(self, session_id: uuid.UUID, risk_score: float, is_breached: bool = False) -> Optional[Session]:
        """Update session risk metrics and breach counts."""
        session = self.active_sessions.get(session_id)
        if session:
            session.tool_call_count += 1
            session.max_risk_score = max(session.max_risk_score, risk_score)
            if is_breached:
                session.containment_breaches += 1
                session.status = "BREACHED"
        return session
