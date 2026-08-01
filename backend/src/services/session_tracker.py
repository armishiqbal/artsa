"""Session Tracker Service with Adjacency List Session Graph."""

import uuid
from typing import Dict, List, Optional
from src.core.models.events import ToolCallEvent
from src.core.models.sessions import Session


class SessionTracker:
    """Tracks session execution states and adjacency graph of agent tool invocations."""

    def __init__(self) -> None:
        self.active_sessions: Dict[str, Session] = {}
        self.session_events: Dict[str, List[ToolCallEvent]] = {}

    def start_session(self, agent_id: str, tenant_id: str = "default_tenant") -> Session:
        """Start a new agent execution session."""
        session = Session(agent_id=agent_id, tenant_id=tenant_id, status="ACTIVE")
        self.active_sessions[str(session.id)] = session
        self.session_events[str(session.id)] = []
        return session

    def get_session(self, session_id: uuid.UUID) -> Optional[Session]:
        """Fetch session by ID."""
        return self.active_sessions.get(str(session_id))

    def add_event_to_session(self, session_id: uuid.UUID, event: ToolCallEvent) -> None:
        """Record tool call event into session trajectory."""
        sid_str = str(session_id)
        if sid_str not in self.session_events:
            self.session_events[sid_str] = []
        self.session_events[sid_str].append(event)

        session = self.active_sessions.get(sid_str)
        if session:
            session.tool_call_count += 1

    def get_session_graph(self, session_id: uuid.UUID) -> Dict[str, List[str]]:
        """Build adjacency list graph of agent -> tool calls for session trajectory."""
        events = self.session_events.get(str(session_id), [])
        graph: Dict[str, List[str]] = {}
        for evt in events:
            agent = evt.agent_id
            if agent not in graph:
                graph[agent] = []
            graph[agent].append(evt.tool_name)
        return graph

    def update_session(self, session_id: uuid.UUID, risk_score: float, is_breached: bool = False) -> Optional[Session]:
        """Update session risk metrics and status."""
        session = self.get_session(session_id)
        if session:
            session.tool_call_count += 1
            session.max_risk_score = max(session.max_risk_score, risk_score)
            if is_breached:
                session.containment_breaches += 1
                session.status = "BREACHED"
        return session
