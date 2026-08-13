"""In-memory fallback store for events, sessions, and evaluations."""

from __future__ import annotations

import uuid
from datetime import UTC
from typing import Any

from src.core.models.events import ToolCallEvent
from src.core.models.sessions import Session

_events: dict[str, list[ToolCallEvent]] = {}
_sessions: dict[str, Session] = {}
_evaluations: dict[str, dict[str, Any]] = {}


def store_event(event: ToolCallEvent) -> ToolCallEvent:
    sid = str(event.session_id)
    _events.setdefault(sid, []).append(event)
    return event


def get_events_by_session(session_id: uuid.UUID) -> list[ToolCallEvent]:
    return list(_events.get(str(session_id), []))


def store_session(session: Session) -> Session:
    _sessions[str(session.id)] = session
    return session


def get_session(session_id: uuid.UUID) -> Session | None:
    return _sessions.get(str(session_id))


def list_sessions(
    tenant_id: str | None = None,
    status: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[Session]:
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


def apply_session_status(
    session_id: uuid.UUID,
    status: str,
    *,
    ended: bool = False,
) -> Session | None:
    from datetime import datetime

    session = get_session(session_id)
    if not session:
        return None
    session.status = status  # type: ignore[assignment]
    if ended:
        session.ended_at = datetime.now(UTC)
        if status == "BREACHED":
            session.containment_breaches += 1
    return session


def store_evaluation(event_id: str, evaluation: dict[str, Any]) -> None:
    _evaluations[event_id] = evaluation


def get_evaluation(event_id: str) -> dict[str, Any] | None:
    return _evaluations.get(event_id)


def get_evaluations_for_session(session_id: uuid.UUID) -> dict[str, dict[str, Any]]:
    sid = str(session_id)
    event_ids = {str(e.id) for e in _events.get(sid, [])}
    return {eid: ev for eid, ev in _evaluations.items() if eid in event_ids}


def clear_all() -> None:
    _events.clear()
    _sessions.clear()
    _evaluations.clear()
