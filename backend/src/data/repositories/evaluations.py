"""Repository for containment evaluation persistence."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.data import memory_store
from src.data.orm import EventEvaluationORM
from src.data.repositories.base import BaseRepository


class EvaluationRepository(BaseRepository[EventEvaluationORM]):
    """Persist and load per-event containment evaluations."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, EventEvaluationORM)
        self._use_memory = settings.is_testing

    def _to_dict(self, row: EventEvaluationORM) -> dict[str, Any]:
        return {
            "risk_score": row.risk_score,
            "verdict": row.verdict,
            "confidence": row.confidence,
            "recommended_action": row.recommended_action,
            "flags": list(row.flags or []),
            "security_event_count": row.security_event_count,
        }

    def _to_orm(
        self,
        event_id: str,
        session_id: str,
        evaluation: dict[str, Any],
    ) -> EventEvaluationORM:
        return EventEvaluationORM(
            event_id=event_id,
            session_id=session_id,
            risk_score=float(evaluation.get("risk_score", 0.0)),
            verdict=str(evaluation.get("verdict", "SAFE")),
            confidence=float(evaluation.get("confidence", 0.0)),
            recommended_action=str(evaluation.get("recommended_action", "NONE")),
            flags=list(evaluation.get("flags") or []),
            security_event_count=int(evaluation.get("security_event_count", 0)),
        )

    async def upsert(
        self,
        event_id: str,
        session_id: UUID,
        evaluation: dict[str, Any],
    ) -> None:
        memory_store.store_evaluation(event_id, evaluation)
        if self._use_memory:
            return

        sid = str(session_id)
        result = await self.session.execute(
            select(EventEvaluationORM).where(EventEvaluationORM.event_id == event_id)
        )
        row = result.scalar_one_or_none()
        if row:
            row.risk_score = float(evaluation.get("risk_score", 0.0))
            row.verdict = str(evaluation.get("verdict", "SAFE"))
            row.confidence = float(evaluation.get("confidence", 0.0))
            row.recommended_action = str(evaluation.get("recommended_action", "NONE"))
            row.flags = list(evaluation.get("flags") or [])
            row.security_event_count = int(evaluation.get("security_event_count", 0))
        else:
            self.session.add(self._to_orm(event_id, sid, evaluation))
        await self.session.commit()

    async def get_by_session(self, session_id: UUID) -> dict[str, dict[str, Any]]:
        if self._use_memory:
            return memory_store.get_evaluations_for_session(session_id)

        result = await self.session.execute(
            select(EventEvaluationORM).where(EventEvaluationORM.session_id == str(session_id))
        )
        rows = result.scalars().all()
        if rows:
            return {row.event_id: self._to_dict(row) for row in rows}

        return memory_store.get_evaluations_for_session(session_id)

    async def get_by_event(self, event_id: str) -> dict[str, Any] | None:
        cached = memory_store.get_evaluation(event_id)
        if cached:
            return cached
        if self._use_memory:
            return None

        result = await self.session.execute(
            select(EventEvaluationORM).where(EventEvaluationORM.event_id == event_id)
        )
        row = result.scalar_one_or_none()
        return self._to_dict(row) if row else None

    async def bulk_get_for_events(self, event_ids: list[str]) -> dict[str, dict[str, Any]]:
        if not event_ids:
            return {}
        if self._use_memory:
            return {eid: ev for eid in event_ids if (ev := memory_store.get_evaluation(eid))}

        result = await self.session.execute(
            select(EventEvaluationORM).where(EventEvaluationORM.event_id.in_(event_ids))
        )
        return {row.event_id: self._to_dict(row) for row in result.scalars().all()}
