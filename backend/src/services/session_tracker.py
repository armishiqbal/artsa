"""Session Tracker Service with Adjacency List Session Graph."""

import uuid
from datetime import UTC

from src.core.models.events import ToolCallEvent
from src.core.models.sessions import Session


class SessionTracker:
    """Tracks session execution states and adjacency graph of agent tool invocations."""

    def __init__(self) -> None:
        self.active_sessions: dict[str, Session] = {}
        self.session_events: dict[str, list[ToolCallEvent]] = {}
        self.blocked_tools: dict[str, set[str]] = {}

    def start_session(self, agent_id: str, tenant_id: str = "default_tenant") -> Session:
        """Start a new agent execution session."""
        session = Session(agent_id=agent_id, tenant_id=tenant_id, status="ACTIVE")
        self.active_sessions[str(session.id)] = session
        self.session_events[str(session.id)] = []
        return session

    def get_session(self, session_id: uuid.UUID) -> Session | None:
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

    def get_session_graph(self, session_id: uuid.UUID) -> dict[str, list[str]]:
        """Build adjacency list graph of agent -> tool calls for session trajectory."""
        events = self.session_events.get(str(session_id), [])
        graph: dict[str, list[str]] = {}
        for evt in events:
            agent = evt.agent_id
            if agent not in graph:
                graph[agent] = []
            graph[agent].append(evt.tool_name)
        return graph

    def update_session(self, session_id: uuid.UUID, risk_score: float, is_breached: bool = False) -> Session | None:
        """Update session risk metrics and status."""
        session = self.get_session(session_id)
        if session:
            session.tool_call_count += 1
            session.max_risk_score = max(session.max_risk_score, risk_score)
            if is_breached:
                session.containment_breaches += 1
                session.status = "BREACHED"
        return session

    def block_tool(self, session_id: uuid.UUID | str, tool_name: str) -> bool:
        """Revoke execution permissions for a specific tool on this session."""
        sid = str(session_id)
        clean_tool = tool_name.strip().lower()
        if not clean_tool:
            return False
        if sid not in self.blocked_tools:
            self.blocked_tools[sid] = set()
        self.blocked_tools[sid].add(clean_tool)
        return True

    def unblock_tool(self, session_id: uuid.UUID | str, tool_name: str) -> bool:
        """Restore execution permissions for a specific tool on this session."""
        sid = str(session_id)
        clean_tool = tool_name.strip().lower()
        if sid in self.blocked_tools and clean_tool in self.blocked_tools[sid]:
            self.blocked_tools[sid].remove(clean_tool)
            return True
        return False

    def is_tool_blocked(self, session_id: uuid.UUID | str, tool_name: str) -> bool:
        """Check if a tool is currently blocked for this session."""
        sid = str(session_id)
        clean_tool = tool_name.strip().lower()
        return clean_tool in self.blocked_tools.get(sid, set())

    def get_blocked_tools(self, session_id: uuid.UUID | str) -> list[str]:
        """Return list of all blocked tool names for this session."""
        sid = str(session_id)
        return sorted(self.blocked_tools.get(sid, set()))

    def apply_action(
        self,
        session_id: uuid.UUID,
        action: str,
        tool_name: str | None = None,
    ) -> Session | None:
        """Apply containment action to an in-memory session.

        WS-3.3 incident workflow: RELEASE restores a quarantined (or breached)
        session to ACTIVE after operator review; CLOSE closes a contained
        session permanently without re-activating it.
        BLOCK_TOOL revokes granular execution permissions for a specific tool.
        """
        from datetime import datetime

        session = self.get_session(session_id)
        if not session:
            return None
        action_u = action.upper()
        if action_u == "KILL":
            session.status = "BREACHED"
            session.ended_at = datetime.now(UTC)
            session.containment_breaches += 1
        elif action_u == "QUARANTINE":
            session.status = "QUARANTINED"
        elif action_u == "PENDING_APPROVAL":
            session.status = "PENDING_APPROVAL"
        elif action_u == "THROTTLE":
            # Soft control — keep ACTIVE but mark elevated risk floor
            session.max_risk_score = max(session.max_risk_score, 50.0)
        elif action_u == "BLOCK_TOOL":
            if tool_name:
                self.block_tool(session_id, tool_name)
            # Retain session status, but record containment intervention
            session.max_risk_score = max(session.max_risk_score, 65.0)
        elif action_u == "RELEASE":
            # Operator reviewed the incident: resume normal operation.
            if session.status in ("QUARANTINED", "BREACHED", "PENDING_APPROVAL"):
                session.status = "ACTIVE"
                session.ended_at = None
        elif action_u == "CLOSE":
            session.status = "CLOSED"
            session.ended_at = datetime.now(UTC)
        return session

    def is_contained(self, session_id: uuid.UUID) -> bool:
        session = self.get_session(session_id)
        return bool(session and session.status in ("BREACHED", "QUARANTINED", "PENDING_APPROVAL", "CLOSED"))


session_tracker = SessionTracker()
