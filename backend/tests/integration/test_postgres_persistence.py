"""Postgres persistence integration tests (run when DATABASE_URL points to Postgres)."""

import os
import uuid

import pytest

pytestmark = pytest.mark.skipif(
    os.getenv("RUN_POSTGRES_TESTS", "").lower() not in ("1", "true", "yes"),
    reason="Set RUN_POSTGRES_TESTS=1 with Postgres DATABASE_URL to run",
)


@pytest.fixture
async def postgres_session():
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from src.core.config import settings
    from src.data.db import Base
    from src.data.orm import EventEvaluationORM, SessionORM, ToolCallEventORM  # noqa: F401

    url = settings.effective_database_url
    engine = create_async_engine(url, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session

    await engine.dispose()


@pytest.mark.asyncio
async def test_postgres_evaluation_roundtrip(postgres_session, monkeypatch):
    monkeypatch.setattr("src.core.config.settings.ENVIRONMENT", "integration_test")

    from src.data.repositories.evaluations import EvaluationRepository

    repo = EvaluationRepository(postgres_session)
    session_id = uuid.uuid4()
    event_id = str(uuid.uuid4())

    await repo.upsert(
        event_id,
        session_id,
        {
            "risk_score": 77.0,
            "verdict": "SUSPICIOUS",
            "confidence": 0.8,
            "recommended_action": "QUARANTINE",
            "flags": ["TEST"],
            "security_event_count": 1,
        },
    )

    loaded = await repo.get_by_event(event_id)
    assert loaded is not None
    assert loaded["verdict"] == "SUSPICIOUS"
