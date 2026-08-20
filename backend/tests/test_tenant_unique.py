"""Tests for Phase 4.7 — per-tenant unique integration names + agent-baseline
composite primary key. Uses a fresh SQLite temp DB (create_all applies the
current ORM metadata), so it runs in CI without Postgres."""

from __future__ import annotations

import tempfile
import uuid

import pytest
from src.core.models.agents import AgentBaseline


@pytest.fixture
async def db_session():
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from src.data.db import Base
    from src.data.orm import (  # noqa: F401
        AgentBaselineORM,
        CustomIntegrationORM,
    )

    url = "sqlite+aiosqlite:///" + tempfile.mktemp(suffix="_tenant_unique_test.db")
    engine = create_async_engine(url, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session
    await engine.dispose()


async def test_integration_names_unique_per_tenant(db_session) -> None:
    from sqlalchemy import select
    from src.data.integration_store import upsert_integration
    from src.data.orm import CustomIntegrationORM

    # Same connector name, different tenants → both allowed (per-tenant unique).
    await upsert_integration(
        db_session, name="slack", target_url="https://hooks.slack.com/A", tenant_id="acme"
    )
    await upsert_integration(
        db_session, name="slack", target_url="https://hooks.slack.com/B", tenant_id="globex"
    )
    rows = (await db_session.execute(select(CustomIntegrationORM))).scalars().all()
    assert len(rows) == 2
    assert {(r.tenant_id, r.name) for r in rows} == {("acme", "slack"), ("globex", "slack")}


async def test_integration_name_dedupes_within_tenant(db_session) -> None:
    from sqlalchemy import select
    from src.data.integration_store import upsert_integration
    from src.data.orm import CustomIntegrationORM

    await upsert_integration(
        db_session, name="pagerduty", target_url="https://api.pagerduty.com/1", tenant_id="acme"
    )
    # Second upsert with the same name+tenant updates, does not duplicate.
    await upsert_integration(
        db_session, name="pagerduty", target_url="https://api.pagerduty.com/2", tenant_id="acme"
    )
    rows = (
        (
            await db_session.execute(
                select(CustomIntegrationORM).where(CustomIntegrationORM.tenant_id == "acme")
            )
        )
        .scalars()
        .all()
    )
    assert len(rows) == 1
    assert rows[0].target_url == "https://api.pagerduty.com/2"


async def test_agent_baseline_composite_pk_per_tenant(db_session) -> None:
    from src.data.repositories.agents import AgentsRepository

    agent_id = str(uuid.uuid4())
    repo = AgentsRepository(db_session)

    b1 = AgentBaseline(agent_id=agent_id, tool_frequency={"read_file": 5.0})
    b2 = AgentBaseline(agent_id=agent_id, tool_frequency={"exec_command": 3.0})

    # Same agent_id in two tenants → two independent baselines.
    saved_a = await repo.upsert_baseline(agent_id, b1, tenant_id="acme")
    saved_g = await repo.upsert_baseline(agent_id, b2, tenant_id="globex")
    assert saved_a.tool_frequency != saved_g.tool_frequency

    got_acme = await repo.get_baseline(agent_id, tenant_id="acme")
    got_globex = await repo.get_baseline(agent_id, tenant_id="globex")
    assert got_acme is not None and got_acme.tool_frequency.get("read_file") == 5.0
    assert got_globex is not None and got_globex.tool_frequency.get("exec_command") == 3.0
