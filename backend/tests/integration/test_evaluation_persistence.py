"""Integration tests for evaluation persistence in SQLite."""

import asyncio
import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.core.config import settings
from src.data.db import Base
from src.data.repositories.evaluations import EvaluationRepository


async def _make_session(monkeypatch) -> AsyncSession:
    monkeypatch.setattr(settings, "ENVIRONMENT", "integration_test")
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    return factory, engine


def test_evaluation_persisted_and_loaded(monkeypatch):
    async def _run():
        session_factory, engine = await _make_session(monkeypatch)
        async with session_factory() as session:
            repo = EvaluationRepository(session)
            session_id = uuid.uuid4()
            event_id = str(uuid.uuid4())
            evaluation = {
                "risk_score": 87.5,
                "verdict": "BREACHED",
                "confidence": 0.92,
                "recommended_action": "KILL",
                "flags": ["PRIVILEGE_ESCALATION"],
                "security_event_count": 2,
            }
            await repo.upsert(event_id, session_id, evaluation)
            loaded = await repo.get_by_event(event_id)
            assert loaded is not None
            assert loaded["risk_score"] == 87.5
            assert loaded["verdict"] == "BREACHED"
        await engine.dispose()

    asyncio.run(_run())


def test_evaluations_by_session(monkeypatch):
    async def _run():
        session_factory, engine = await _make_session(monkeypatch)
        async with session_factory() as session:
            repo = EvaluationRepository(session)
            session_id = uuid.uuid4()
            e1, e2 = str(uuid.uuid4()), str(uuid.uuid4())
            await repo.upsert(
                e1,
                session_id,
                {"risk_score": 40.0, "verdict": "SAFE", "confidence": 0.5, "recommended_action": "NONE", "flags": []},
            )
            await repo.upsert(
                e2,
                session_id,
                {"risk_score": 91.0, "verdict": "BREACHED", "confidence": 0.95, "recommended_action": "KILL", "flags": ["JAILBREAK"]},
            )
            by_session = await repo.get_by_session(session_id)
            assert set(by_session.keys()) == {e1, e2}
            assert by_session[e2]["verdict"] == "BREACHED"
        await engine.dispose()

    asyncio.run(_run())


def test_evaluation_upsert_updates_existing(monkeypatch):
    async def _run():
        session_factory, engine = await _make_session(monkeypatch)
        async with session_factory() as session:
            repo = EvaluationRepository(session)
            session_id = uuid.uuid4()
            event_id = str(uuid.uuid4())
            await repo.upsert(
                event_id,
                session_id,
                {"risk_score": 50.0, "verdict": "SUSPICIOUS", "confidence": 0.6, "recommended_action": "ALERT", "flags": []},
            )
            await repo.upsert(
                event_id,
                session_id,
                {"risk_score": 95.0, "verdict": "BREACHED", "confidence": 0.99, "recommended_action": "KILL", "flags": ["ESCALATION"]},
            )
            loaded = await repo.get_by_event(event_id)
            assert loaded["risk_score"] == 95.0
            assert loaded["verdict"] == "BREACHED"
        await engine.dispose()

    asyncio.run(_run())
