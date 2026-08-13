"""Sync campaign job persistence for background workers."""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from src.core.config import settings
from src.data.orm import CampaignJobORM

_memory_jobs: dict[str, dict[str, Any]] = {}


def _sync_database_url() -> str:
    url = settings.SYNC_DATABASE_URL
    if settings.USE_SQLITE and "sqlite" not in url:
        url = "sqlite:///./data/artsa.db"
    return url


def _get_session_factory() -> sessionmaker[Session] | None:
    if settings.is_testing:
        return None
    engine = create_engine(_sync_database_url(), echo=False)
    Path("./data").mkdir(parents=True, exist_ok=True)
    CampaignJobORM.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


class CampaignJobStore:
    """Persist campaign job state (sync — safe from BackgroundTasks)."""

    def __init__(self) -> None:
        self._factory = _get_session_factory()

    def create(
        self,
        campaign_id: str,
        *,
        name: str,
        provider: str,
        model: str,
        attack_profile: str,
        max_rounds: int,
        request_json: dict[str, Any],
    ) -> None:
        now = datetime.now(UTC)
        record = {
            "id": campaign_id,
            "name": name,
            "status": "RUNNING",
            "provider": provider,
            "model": model,
            "attack_profile": attack_profile,
            "max_rounds": max_rounds,
            "rounds_completed": 0,
            "request_json": request_json,
            "summary_json": None,
            "error": None,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }
        _memory_jobs[campaign_id] = record

        if not self._factory:
            return

        with self._factory() as session:
            session.add(
                CampaignJobORM(
                    id=campaign_id,
                    name=name,
                    status="RUNNING",
                    provider=provider,
                    model=model,
                    attack_profile=attack_profile,
                    max_rounds=max_rounds,
                    rounds_completed=0,
                    request_json=request_json,
                    created_at=now,
                    updated_at=now,
                )
            )
            session.commit()

    def update_progress(self, campaign_id: str, rounds_completed: int) -> None:
        if campaign_id in _memory_jobs:
            _memory_jobs[campaign_id]["rounds_completed"] = rounds_completed
            _memory_jobs[campaign_id]["updated_at"] = datetime.now(UTC).isoformat()

        if not self._factory:
            return

        with self._factory() as session:
            row = session.get(CampaignJobORM, campaign_id)
            if row:
                row.rounds_completed = rounds_completed
                row.updated_at = datetime.now(UTC)
                session.commit()

    def complete(self, campaign_id: str, summary: dict[str, Any]) -> None:
        if campaign_id in _memory_jobs:
            _memory_jobs[campaign_id]["status"] = "COMPLETED"
            _memory_jobs[campaign_id]["summary_json"] = summary
            _memory_jobs[campaign_id]["rounds_completed"] = summary.get(
                "completed_rounds", _memory_jobs[campaign_id]["rounds_completed"]
            )

        if not self._factory:
            return

        with self._factory() as session:
            row = session.get(CampaignJobORM, campaign_id)
            if row:
                row.status = "COMPLETED"
                row.summary_json = summary
                row.rounds_completed = int(summary.get("completed_rounds", row.rounds_completed))
                row.updated_at = datetime.now(UTC)
                session.commit()

    def fail(self, campaign_id: str, error: str) -> None:
        if campaign_id in _memory_jobs:
            _memory_jobs[campaign_id]["status"] = "FAILED"
            _memory_jobs[campaign_id]["error"] = error

        if not self._factory:
            return

        with self._factory() as session:
            row = session.get(CampaignJobORM, campaign_id)
            if row:
                row.status = "FAILED"
                row.error = error
                row.updated_at = datetime.now(UTC)
                session.commit()

    def get(self, campaign_id: str) -> dict[str, Any] | None:
        if campaign_id in _memory_jobs:
            return dict(_memory_jobs[campaign_id])

        if not self._factory:
            return None

        with self._factory() as session:
            row = session.get(CampaignJobORM, campaign_id)
            return self._to_dict(row) if row else None

    def list_jobs(self, limit: int = 50) -> list[dict[str, Any]]:
        jobs = list(_memory_jobs.values())

        if self._factory:
            with self._factory() as session:
                result = session.execute(
                    select(CampaignJobORM).order_by(CampaignJobORM.created_at.desc()).limit(limit)
                )
                for row in result.scalars().all():
                    if not any(j["id"] == row.id for j in jobs):
                        jobs.append(self._to_dict(row))

        return jobs[:limit]

    @staticmethod
    def _to_dict(row: CampaignJobORM) -> dict[str, Any]:
        return {
            "id": row.id,
            "name": row.name,
            "status": row.status,
            "provider": row.provider,
            "model": row.model,
            "attack_profile": row.attack_profile,
            "max_rounds": row.max_rounds,
            "rounds_completed": row.rounds_completed,
            "request_json": row.request_json or {},
            "summary_json": row.summary_json,
            "error": row.error,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        }


campaign_job_store = CampaignJobStore()
