"""Batched-ingest hot path: deferred DB commits + a single Redis pipeline flush."""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from src.core.config import settings
from src.core.models.sessions import Session
from src.data.db import Base
from src.data.orm import EventEvaluationORM, SessionORM
from src.data.redis_client import get_redis_stream_client, reset_redis_client
from src.data.repositories.evaluations import EvaluationRepository
from src.data.repositories.sessions import SessionRepository


@pytest.fixture
async def db_env(tmp_path, monkeypatch):
    """Real file-backed SQLite with the full schema, in a non-testing env."""
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'batch_artsa.db'}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session, factory
    await engine.dispose()


async def test_deferred_commits_persist_on_final_commit(db_env):
    """repo calls with commit=False accumulate; one commit persists everything.

    This is exactly what the batched ingest loop does: N per-event mutations
    with commit=False, then a single ``db.commit()`` at the end.
    """
    session, _factory = db_env
    sid = uuid.uuid4()

    sess_repo = SessionRepository(session)
    await sess_repo.create_session(Session(id=sid, agent_id="defer", tenant_id="t"), commit=False)
    await sess_repo.update_risk_score(sid, 88.0, breached=True, commit=False)

    await EvaluationRepository(session).upsert(
        str(sid),
        sid,
        {
            "risk_score": 88.0,
            "verdict": "BREACHED",
            "confidence": 0.9,
            "recommended_action": "KILL",
            "flags": ["test"],
            "security_event_count": 1,
        },
        commit=False,
    )

    await session.commit()

    rows = (await session.execute(select(SessionORM))).scalars().all()
    assert len(rows) == 1
    assert rows[0].max_risk_score == 88.0
    assert rows[0].status == "BREACHED"
    assert rows[0].containment_breaches == 1

    evals = (await session.execute(select(EventEvaluationORM))).scalars().all()
    assert len(evals) == 1
    assert evals[0].verdict == "BREACHED"
    assert evals[0].risk_score == 88.0


async def test_default_commit_persists_without_extra_commit(db_env):
    """The commit=True default is unchanged: a fresh connection sees the row."""
    session, factory = db_env
    sid = uuid.uuid4()
    await SessionRepository(session).create_session(Session(id=sid, agent_id="a", tenant_id="t"))

    async with factory() as fresh:
        rows = (
            (await fresh.execute(select(SessionORM).where(SessionORM.id == str(sid))))
            .scalars()
            .all()
        )
        assert len(rows) == 1


def test_ingest_batch_publishes_all_events_to_redis_stream():
    """A batched ingest publishes every event to events:incoming (one flush)."""
    from src.api.main import app

    reset_redis_client()
    client = TestClient(app)
    sid = str(uuid.uuid4())
    events = [
        {
            "id": str(uuid.uuid4()),
            "session_id": sid,
            "agent_id": "batch-redis",
            "tool_name": "read_file",
            "arguments": {"path": "/tmp/a"},
        }
        for _ in range(3)
    ]

    res = client.post("/api/v1/ingest", json=events)
    assert res.status_code in (200, 201)

    redis_client = get_redis_stream_client()
    stream = redis_client._streams["events:incoming"]
    assert len(stream) == 3
    assert all(e["session_id"] == sid for e in stream)
