"""Repository tests for AI agent and behavioral baseline persistence."""

import asyncio

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from src.core.models.agents import Agent, AgentBaseline
from src.data.db import Base
from src.data.orm import AgentBaselineORM, AgentORM  # noqa: F401  (register tables on metadata)
from src.data.repositories.agents import AgentsRepository


async def _make_session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    return factory, engine


def test_agent_persisted_and_loaded():
    async def _run():
        session_factory, engine = await _make_session()
        async with session_factory() as session:
            repo = AgentsRepository(session)
            agent = Agent(
                id="agent-test-01",
                tenant_id="default_tenant",
                name="Test Agent",
                status="AT_RISK",
                total_sessions=7,
                total_breaches=2,
            )
            await repo.upsert_agent(agent)

            loaded = await repo.get_agent("agent-test-01")
            assert loaded is not None
            assert loaded.id == "agent-test-01"
            assert loaded.tenant_id == "default_tenant"
            assert loaded.name == "Test Agent"
            assert loaded.status == "AT_RISK"
            assert loaded.total_sessions == 7
            assert loaded.total_breaches == 2
            assert loaded.last_seen is not None

            listed = await repo.list_agents("default_tenant")
            assert [a.id for a in listed] == ["agent-test-01"]
        await engine.dispose()

    asyncio.run(_run())


def test_agent_upsert_updates_existing_row():
    async def _run():
        session_factory, engine = await _make_session()
        async with session_factory() as session:
            repo = AgentsRepository(session)
            await repo.upsert_agent(
                Agent(id="agent-test-02", tenant_id="default_tenant", name="First Name")
            )
            await repo.upsert_agent(
                Agent(
                    id="agent-test-02",
                    tenant_id="default_tenant",
                    name="Renamed Agent",
                    status="QUARANTINED",
                    total_sessions=10,
                    total_breaches=4,
                )
            )

            loaded = await repo.get_agent("agent-test-02")
            assert loaded is not None
            assert loaded.name == "Renamed Agent"
            assert loaded.status == "QUARANTINED"
            assert loaded.total_sessions == 10
            assert loaded.total_breaches == 4
            assert len(await repo.list_agents("default_tenant")) == 1
        await engine.dispose()

    asyncio.run(_run())


def test_list_agents_filters_by_tenant():
    async def _run():
        session_factory, engine = await _make_session()
        async with session_factory() as session:
            repo = AgentsRepository(session)
            await repo.upsert_agent(Agent(id="agent-a-01", tenant_id="tenant-a", name="Agent A"))
            await repo.upsert_agent(Agent(id="agent-b-01", tenant_id="tenant-b", name="Agent B"))

            tenant_a = await repo.list_agents("tenant-a")
            assert [a.id for a in tenant_a] == ["agent-a-01"]
            assert [a.tenant_id for a in tenant_a] == ["tenant-a"]

            tenant_b = await repo.list_agents("tenant-b")
            assert [a.id for a in tenant_b] == ["agent-b-01"]
        await engine.dispose()

    asyncio.run(_run())


def test_get_agent_missing_returns_none():
    async def _run():
        session_factory, engine = await _make_session()
        async with session_factory() as session:
            repo = AgentsRepository(session)
            assert await repo.get_agent("agent-does-not-exist") is None
        await engine.dispose()

    asyncio.run(_run())


def test_baseline_upsert_creates_and_loads():
    async def _run():
        session_factory, engine = await _make_session()
        async with session_factory() as session:
            repo = AgentsRepository(session)
            baseline = AgentBaseline(
                agent_id="agent-test-01",
                tool_frequency={"search_docs": 0.8, "fetch_user_profile": 0.2},
                common_file_paths=["/docs/help.json"],
                avg_session_duration=120.5,
            )
            stored = await repo.upsert_baseline("agent-test-01", baseline)
            assert stored.agent_id == "agent-test-01"
            assert stored.tool_frequency == {"search_docs": 0.8, "fetch_user_profile": 0.2}
            assert stored.common_file_paths == ["/docs/help.json"]
            assert stored.avg_session_duration == 120.5

            loaded = await repo.get_baseline("agent-test-01")
            assert loaded is not None
            assert loaded.agent_id == "agent-test-01"
            assert loaded.tool_frequency == {"search_docs": 0.8, "fetch_user_profile": 0.2}
            assert loaded.common_file_paths == ["/docs/help.json"]
            assert loaded.avg_session_duration == 120.5
            assert loaded.updated_at is not None
        await engine.dispose()

    asyncio.run(_run())


def test_baseline_upsert_updates_existing():
    async def _run():
        session_factory, engine = await _make_session()
        async with session_factory() as session:
            repo = AgentsRepository(session)
            await repo.upsert_baseline(
                "agent-test-01",
                AgentBaseline(
                    agent_id="agent-test-01",
                    tool_frequency={"search_docs": 1.0},
                    common_file_paths=["/docs/old.json"],
                    avg_session_duration=10.0,
                ),
            )
            await repo.upsert_baseline(
                "agent-test-01",
                AgentBaseline(
                    agent_id="agent-test-01",
                    tool_frequency={"exec_command": 0.5},
                    common_file_paths=["/docs/new.json"],
                    avg_session_duration=300.0,
                ),
            )

            loaded = await repo.get_baseline("agent-test-01")
            assert loaded is not None
            assert loaded.tool_frequency == {"exec_command": 0.5}
            assert loaded.common_file_paths == ["/docs/new.json"]
            assert loaded.avg_session_duration == 300.0
        await engine.dispose()

    asyncio.run(_run())


def test_get_baseline_missing_returns_none():
    async def _run():
        session_factory, engine = await _make_session()
        async with session_factory() as session:
            repo = AgentsRepository(session)
            assert await repo.get_baseline("agent-without-baseline") is None
        await engine.dispose()

    asyncio.run(_run())
