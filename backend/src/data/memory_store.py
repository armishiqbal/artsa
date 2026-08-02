"""In-memory fallback store for events, sessions, and evaluations."""

from __future__ import annotations

import uuid
from typing import Any, Dict, List, Optional

from src.core.models.events import ToolCallEvent
from src.core.models.sessions import Session

_events: Dict[str, List[ToolCallEvent]] = {}
_sessions: Dict[str, Session] = {}
_evaluations: Dict[str, Dict[str, Any]] = {}


def store_event(event: ToolCallEvent) -> ToolCallEvent:
    sid = str(event.session_id)
    _events.setdefault(sid, []).append(event)
    return event


def get_events_by_session(session_id: uuid.UUID) -> List[ToolCallEvent]:
    return list(_events.get(str(session_id), []))


def store_session(session: Session) -> Session:
    _sessions[str(session.id)] = session
    return session


def get_session(session_id: uuid.UUID) -> Optional[Session]:
    return _sessions.get(str(session_id))


def list_sessions(
    tenant_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> List[Session]:
    sessions = list(_sessions.values())
    if tenant_id:
        sessions = [s for s in sessions if s.tenant_id == tenant_id]
    if status:
        sessions = [s for s in sessions if s.status == status]
    return sessions[offset : offset + limit]


def update_session_risk(session_id: uuid.UUID, risk_score: float, breached: bool = False) -> None:
    session = get_session(session_id)
    if not session:
        return
    session.max_risk_score = max(session.max_risk_score, risk_score)
    if breached:
        session.containment_breaches += 1
        session.status = "BREACHED"


def store_evaluation(event_id: str, evaluation: Dict[str, Any]) -> None:
    _evaluations[event_id] = evaluation


def get_evaluation(event_id: str) -> Optional[Dict[str, Any]]:
    return _evaluations.get(event_id)


def get_evaluations_for_session(session_id: uuid.UUID) -> Dict[str, Dict[str, Any]]:
    sid = str(session_id)
    event_ids = {str(e.id) for e in _events.get(sid, [])}
    return {eid: ev for eid, ev in _evaluations.items() if eid in event_ids}


def clear_all() -> None:
    _events.clear()
    _sessions.clear()
    _evaluations.clear()
