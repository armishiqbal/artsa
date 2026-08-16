"""Tests for the MongoDB sink's expanded domain coverage.

Covers the producers for the new collections (sessions, tool_calls, campaigns,
agents, agent_baselines) and the wiring that fires them from the repository /
store write paths — all with fake inserts and no real Mongo connection.
"""

from __future__ import annotations

import asyncio
import time
from datetime import UTC, datetime
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from src.core.models.agents import Agent, AgentBaseline
from src.core.models.events import ToolCallEvent
from src.core.models.sessions import Session
from src.data.db import Base
from src.data.orm import AgentBaselineORM, AgentORM, SessionORM, ToolCallEventORM  # noqa: F401  (register tables on metadata)
from src.services import mongo_sink as mongo_sink_module
from src.services.mongo_sink import MongoSink


def _fresh_sink() -> MongoSink:
    return MongoSink(maxsize=10)


def _wait_until(predicate, timeout: float = 2.0) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if predicate():
            return
        time.sleep(0.02)
    raise AssertionError("timed out waiting for worker")


@pytest.fixture(autouse=True)
def _mongo_settings(monkeypatch):
    """Enable the sink with an innocuous URI so producers actually enqueue."""
    monkeypatch.setattr(
        "src.services.mongo_sink.settings.ARTSA_MONGODB_URI",
        "mongodb://localhost:27017/test?authSource=admin",
    )
    monkeypatch.setattr("src.services.mongo_sink.settings.ARTSA_MONGODB_DB", "artsa")


def _capture_sink(monkeypatch) -> tuple[MongoSink, list[tuple[str, dict]]]:
    captured: list[tuple[str, dict]] = []
    sink = _fresh_sink()
    monkeypatch.setattr(sink, "_insert", lambda collection, doc: captured.append((collection, doc)))
    sink.start()
    return sink, captured


# ─────────────────────────────────────────────────────────────────────────────
# Producer document shapes
# ─────────────────────────────────────────────────────────────────────────────


def test_enqueue_session_created_shape(monkeypatch):
    sink, captured = _capture_sink(monkeypatch)
    try:
        sess = Session(
            id=uuid4(),
            agent_id="agent-x",
            tenant_id="default_tenant",
            status="ACTIVE",
            started_at=datetime.now(UTC),
            tool_call_count=3,
            max_risk_score=12.5,
        )
        sink.enqueue_session(sess, "created")
        _wait_until(lambda: len(captured) == 1)
    finally:
        sink.stop(wait=True)

    collection, doc = captured[0]
    assert collection == "sessions"
    assert doc["type"] == "session"
    assert doc["kind"] == "created"
    assert doc["session_id"] == str(sess.id)
    assert doc["agent_id"] == "agent-x"
    assert doc["tenant_id"] == "default_tenant"
    assert doc["status"] == "ACTIVE"
    assert doc["tool_call_count"] == 3
    assert doc["max_risk_score"] == 12.5
    assert doc["containment_breaches"] == 0
    assert doc["started_at"] is not None
    assert doc["ended_at"] is None
    assert "ts" in doc


def test_enqueue_tool_call_shape(monkeypatch):
    sink, captured = _capture_sink(monkeypatch)
    try:
        event = ToolCallEvent(
            id=uuid4(),
            session_id=uuid4(),
            agent_id="agent-x",
            tool_name="exec_command",
            arguments={"cmd": "ls -la"},
            response={"exit_code": 0},
            latency_ms=42.5,
        )
        sink.enqueue_tool_call(event)
        _wait_until(lambda: len(captured) == 1)
    finally:
        sink.stop(wait=True)

    collection, doc = captured[0]
    assert collection == "tool_calls"
    assert doc["type"] == "tool_call"
    assert doc["event_id"] == str(event.id)
    assert doc["session_id"] == str(event.session_id)
    assert doc["agent_id"] == "agent-x"
    assert doc["tool_name"] == "exec_command"
    assert doc["arguments"] == {"cmd": "ls -la"}
    assert doc["response"] == {"exit_code": 0}
    assert doc["latency_ms"] == 42.5
    assert doc["timestamp"] is not None
    assert doc["trace_id"] == event.trace_id


def test_enqueue_campaign_shape(monkeypatch):
    sink, captured = _capture_sink(monkeypatch)
    try:
        record = {
            "id": "campaign-1",
            "name": "Credential-Theft Wargame",
            "status": "COMPLETED",
            "provider": "anthropic",
            "model": "claude-sonnet-5",
            "attack_profile": "credential_theft",
            "max_rounds": 5,
            "rounds_completed": 5,
            "request_json": {"targets": ["admin"]},
            "summary_json": {"completed_rounds": 5},
            "error": None,
            "created_at": "2026-08-15T10:00:00+00:00",
            "updated_at": "2026-08-15T10:05:00+00:00",
        }
        sink.enqueue_campaign(record, "completed")
        _wait_until(lambda: len(captured) == 1)
    finally:
        sink.stop(wait=True)

    collection, doc = captured[0]
    assert collection == "campaigns"
    assert doc["type"] == "campaign"
    assert doc["kind"] == "completed"
    assert doc["id"] == "campaign-1"
    assert doc["name"] == "Credential-Theft Wargame"
    assert doc["status"] == "COMPLETED"
    assert doc["provider"] == "anthropic"
    assert doc["model"] == "claude-sonnet-5"
    assert doc["summary_json"]["completed_rounds"] == 5
    assert "ts" in doc


def test_enqueue_agent_shape(monkeypatch):
    sink, captured = _capture_sink(monkeypatch)
    try:
        agent = Agent(
            id="agent-x",
            tenant_id="default_tenant",
            name="Red Agent",
            status="AT_RISK",
            total_sessions=7,
            total_breaches=2,
        )
        sink.enqueue_agent(agent)
        _wait_until(lambda: len(captured) == 1)
    finally:
        sink.stop(wait=True)

    collection, doc = captured[0]
    assert collection == "agents"
    assert doc["type"] == "agent"
    assert doc["agent_id"] == "agent-x"
    assert doc["tenant_id"] == "default_tenant"
    assert doc["name"] == "Red Agent"
    assert doc["agent_type"] == "general"
    assert doc["status"] == "AT_RISK"
    assert doc["total_sessions"] == 7
    assert doc["total_breaches"] == 2
    assert doc["last_seen"] is not None
    assert "ts" in doc


def test_enqueue_agent_baseline_shape(monkeypatch):
    sink, captured = _capture_sink(monkeypatch)
    try:
        sink.enqueue_agent_baseline(
            "agent-x",
            {
                "tool_frequency": {"search_docs": 0.8, "exec_command": 0.2},
                "common_file_paths": ["/docs/help.json"],
                "avg_session_duration": 120.5,
            },
        )
        _wait_until(lambda: len(captured) == 1)
    finally:
        sink.stop(wait=True)

    collection, doc = captured[0]
    assert collection == "agent_baselines"
    assert doc["type"] == "agent_baseline"
    assert doc["agent_id"] == "agent-x"
    assert doc["baseline"]["tool_frequency"] == {"search_docs": 0.8, "exec_command": 0.2}
    assert "ts" in doc


# ─────────────────────────────────────────────────────────────────────────────
# Repository wiring — SQLite-backed
# ─────────────────────────────────────────────────────────────────────────────


async def _make_session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    return factory, engine


def test_session_repository_create_enqueues(monkeypatch):
    enqueued: list[tuple[object, str]] = []
    monkeypatch.setattr(
        mongo_sink_module.mongo_sink, "enqueue_session", lambda s, kind: enqueued.append((s, kind))
    )

    async def _run():
        factory, engine = await _make_session()
        async with factory() as session:
            from src.data.repositories.sessions import SessionRepository

            repo = SessionRepository(session)
            repo._use_memory = False  # force the SQLite path where the hook fires
            sess = Session(id=uuid4(), agent_id="agent-x", tenant_id="default_tenant")
            await repo.create_session(sess)
        await engine.dispose()

    asyncio.run(_run())

    assert len(enqueued) == 1
    obj, kind = enqueued[0]
    assert kind == "created"
    assert str(obj.id) == str(enqueued[0][0].id)


def test_session_repository_risk_and_action_enqueue(monkeypatch):
    kinds: list[str] = []
    monkeypatch.setattr(
        mongo_sink_module.mongo_sink, "enqueue_session", lambda s, kind: kinds.append(kind)
    )

    async def _run():
        factory, engine = await _make_session()
        async with factory() as session:
            from src.data.repositories.sessions import SessionRepository

            repo = SessionRepository(session)
            repo._use_memory = False
            sess = Session(id=uuid4(), agent_id="agent-x", tenant_id="default_tenant")
            await repo.create_session(sess)
            await repo.update_risk_score(sess.id, 85.0, breached=True)
            await repo.apply_action(sess.id, "KILL")
        await engine.dispose()

    asyncio.run(_run())

    assert kinds == ["created", "breach", "action"]


def test_event_repository_bulk_insert_enqueues(monkeypatch):
    enqueued: list[object] = []
    expected_ids: list[str] = []
    monkeypatch.setattr(
        mongo_sink_module.mongo_sink, "enqueue_tool_call", lambda ev: enqueued.append(ev)
    )

    async def _run():
        nonlocal expected_ids
        factory, engine = await _make_session()
        async with factory() as session:
            from src.data.repositories.events import EventRepository

            repo = EventRepository(session)
            repo._use_memory = False
            events = [
                ToolCallEvent(
                    id=uuid4(), session_id=uuid4(), agent_id="agent-x", tool_name="exec_command"
                ),
                ToolCallEvent(
                    id=uuid4(), session_id=uuid4(), agent_id="agent-x", tool_name="read_file"
                ),
            ]
            expected_ids = [str(e.id) for e in events]
            await repo.bulk_insert(events)
        await engine.dispose()

    asyncio.run(_run())

    assert [str(e.id) for e in enqueued] == expected_ids


def test_agent_repository_upserts_enqueue(monkeypatch):
    enqueued_agents: list[object] = []
    enqueued_baselines: list[tuple[str, dict]] = []
    monkeypatch.setattr(
        mongo_sink_module.mongo_sink, "enqueue_agent", lambda a: enqueued_agents.append(a)
    )
    monkeypatch.setattr(
        mongo_sink_module.mongo_sink,
        "enqueue_agent_baseline",
        lambda agent_id, baseline: enqueued_baselines.append((agent_id, baseline)),
    )

    async def _run():
        factory, engine = await _make_session()
        async with factory() as session:
            from src.data.repositories.agents import AgentsRepository

            repo = AgentsRepository(session)
            await repo.upsert_agent(
                Agent(id="agent-x", tenant_id="default_tenant", name="Red Agent", status="AT_RISK")
            )
            await repo.upsert_baseline(
                "agent-x",
                AgentBaseline(
                    agent_id="agent-x",
                    tool_frequency={"search_docs": 0.8, "exec_command": 0.2},
                    common_file_paths=["/docs/help.json"],
                    avg_session_duration=120.5,
                ),
            )
        await engine.dispose()

    asyncio.run(_run())

    assert len(enqueued_agents) == 1
    assert str(enqueued_agents[0].id) == "agent-x"
    assert enqueued_agents[0].name == "Red Agent"
    assert len(enqueued_baselines) == 1
    agent_id, baseline = enqueued_baselines[0]
    assert agent_id == "agent-x"
    assert baseline["tool_frequency"]["exec_command"] == 0.2


# ─────────────────────────────────────────────────────────────────────────────
# Campaign store wiring
# ─────────────────────────────────────────────────────────────────────────────


def test_campaign_store_lifecycle_enqueues(monkeypatch):
    """The full create→progress→complete→fail flow emits one doc per kind."""
    enqueued: list[str] = []
    monkeypatch.setattr(
        mongo_sink_module.mongo_sink, "enqueue_campaign", lambda record, kind: enqueued.append(kind)
    )

    from src.data.campaign_job_store import CampaignJobStore

    store = CampaignJobStore()
    store.create(
        "c-1",
        name="Wargame",
        provider="anthropic",
        model="claude-sonnet-5",
        attack_profile="credential_theft",
        max_rounds=5,
        request_json={"targets": ["admin"]},
    )
    store.update_progress("c-1", 3)
    store.complete("c-1", {"completed_rounds": 5})
    store.create(
        "c-2",
        name="Broken Run",
        provider="anthropic",
        model="claude-sonnet-5",
        attack_profile="credential_theft",
        max_rounds=5,
        request_json={"targets": ["admin"]},
    )
    store.fail("c-2", "provider error")

    assert enqueued == ["created", "progress", "completed", "created", "failed"]
