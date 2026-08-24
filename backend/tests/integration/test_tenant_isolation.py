"""WS-3.1: two-tenant row-level isolation across the persistence layer.

Run with RUN_POSTGRES_TESTS=1 and a Postgres DATABASE_URL (same contract as
tests/integration/test_postgres_persistence.py). Each test creates data for
tenant "acme" and asserts tenant "globex" queries never see it.
"""

import os
import uuid

import pytest

pytestmark = pytest.mark.skipif(
    os.getenv("RUN_POSTGRES_TESTS", "").lower() not in ("1", "true", "yes"),
    reason="Set RUN_POSTGRES_TESTS=1 with Postgres DATABASE_URL to run",
)


@pytest.fixture
async def postgres_session():
    import tempfile

    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from src.core.config import settings
    from src.data.db import Base
    from src.data.orm import (  # noqa: F401
        AgentBaselineORM,
        AlertORM,
        AlertRuleORM,
        CampaignJobORM,
        CustomIntegrationORM,
        EventEvaluationORM,
        SessionORM,
        ToolCallEventORM,
    )

    url = settings.effective_database_url
    if "sqlite" in url:
        # Fresh temp file so pre-existing dev DBs with an older schema never
        # leak in (create_all does not alter existing tables).
        url = "sqlite+aiosqlite:///" + tempfile.mktemp(suffix="_tenant_test.db")
    engine = create_async_engine(url, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session

    await engine.dispose()


@pytest.mark.asyncio
async def test_evaluation_rows_are_tenant_scoped(postgres_session, monkeypatch):
    monkeypatch.setattr("src.core.config.settings.ENVIRONMENT", "integration_test")

    from src.data.repositories.evaluations import EvaluationRepository

    repo = EvaluationRepository(postgres_session)
    for tenant, verdict in (("acme", "SUSPICIOUS"), ("globex", "BREACHED")):
        await repo.upsert(
            str(uuid.uuid4()),
            uuid.uuid4(),
            {
                "risk_score": 77.0,
                "verdict": verdict,
                "confidence": 0.8,
                "recommended_action": "QUARANTINE",
                "flags": ["TENANT_TEST"],
                "security_event_count": 1,
                "tenant_id": tenant,
            },
        )

    from sqlalchemy import func, select
    from src.data.orm import EventEvaluationORM

    acme_rows = (
        await postgres_session.execute(
            select(func.count()).select_from(EventEvaluationORM).where(
                EventEvaluationORM.tenant_id == "acme"
            )
        )
    ).scalar_one()
    globex_rows = (
        await postgres_session.execute(
            select(func.count()).select_from(EventEvaluationORM).where(
                EventEvaluationORM.tenant_id == "globex"
            )
        )
    ).scalar_one()
    assert acme_rows == 1
    assert globex_rows == 1
    # Cross-tenant read: querying acme's row by event_id must still carry acme's tenant.
    acme_event = (
        await postgres_session.execute(
            select(EventEvaluationORM).where(
                EventEvaluationORM.tenant_id == "acme"
            )
        )
    ).scalars().first()
    assert acme_event.tenant_id == "acme"


@pytest.mark.asyncio
async def test_alert_rows_are_tenant_scoped(postgres_session, monkeypatch):
    monkeypatch.setattr("src.core.config.settings.ENVIRONMENT", "integration_test")

    from src.core.models.alerts import Alert
    from src.data.repositories.alerts import AlertRepository

    repo = AlertRepository(postgres_session)
    for tenant in ("acme", "globex"):
        await repo.create_alert(
            Alert(
                session_id=uuid.uuid4(),
                agent_id="agent-1",
                severity="HIGH",
                title=f"alert for {tenant}",
                message="t",
                risk_score=80.0,
                channel="WEBHOOK",
                tenant_id=tenant,
            ),
            commit=True,
        )

    acme = await repo.list_alerts(tenant_id="acme")
    globex = await repo.list_alerts(tenant_id="globex")
    assert len(acme) == 1 and all(a.tenant_id == "acme" for a in acme)
    assert len(globex) == 1 and all(a.tenant_id == "globex" for a in globex)
    # A tenant-scoped read never returns another tenant's alerts.
    acme_titles = {a.title for a in acme}
    assert "alert for globex" not in acme_titles


@pytest.mark.asyncio
async def test_session_rows_are_tenant_scoped(postgres_session, monkeypatch):
    monkeypatch.setattr("src.core.config.settings.ENVIRONMENT", "integration_test")

    from src.core.models.events import ToolCallEvent
    from src.data.repositories.sessions import SessionRepository

    repo = SessionRepository(postgres_session)
    for tenant in ("acme", "globex"):
        event = ToolCallEvent(
            session_id=uuid.uuid4(),
            agent_id="agent-x",
            tool_name="exec_command",
            arguments={"command": "ls"},
        )
        from src.core.models.sessions import Session

        await repo.create_session(
            Session(id=event.session_id, agent_id="agent-x", tenant_id=tenant),
            commit=True,
        )

    acme = await repo.list_sessions(tenant_id="acme")
    globex = await repo.list_sessions(tenant_id="globex")
    acme_ids = {str(s.id) for s in acme}
    globex_ids = {str(s.id) for s in globex}
    assert acme_ids and globex_ids
    assert acme_ids.isdisjoint(globex_ids), "tenants must never see each other's sessions"


@pytest.mark.asyncio
async def test_integrations_are_tenant_scoped(postgres_session, monkeypatch):
    monkeypatch.setattr("src.core.config.settings.ENVIRONMENT", "integration_test")

    from src.data.integration_store import (
        delete_integration,
        get_integration,
        list_integrations,
        upsert_integration,
    )

    for tenant, name in (("acme", "acme-slack"), ("globex", "globex-slack")):
        await upsert_integration(
            postgres_session,
            name=name,
            target_url="https://hooks.example.com/x",
            tenant_id=tenant,
        )

    acme_rows = await list_integrations(postgres_session, tenant_id="acme")
    globex_rows = await list_integrations(postgres_session, tenant_id="globex")
    assert {r["name"] for r in acme_rows} == {"acme-slack"}
    assert {r["name"] for r in globex_rows} == {"globex-slack"}

    # Tenant-scoped get/delete: acme cannot see or delete globex's connector.
    assert await get_integration(postgres_session, "globex-slack", tenant_id="acme") is None
    assert await get_integration(postgres_session, "acme-slack", tenant_id="acme") is not None
    assert await delete_integration(postgres_session, "globex-slack", tenant_id="acme") is False


def test_campaigns_are_tenant_scoped(monkeypatch):
    """CampaignJobStore uses a SYNC factory (BackgroundTasks-safe) — test it
    against a sync engine on a fresh temp SQLite file."""
    import tempfile

    monkeypatch.setattr("src.core.config.settings.ENVIRONMENT", "integration_test")
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from src.data.campaign_job_store import CampaignJobStore
    from src.data.db import Base
    from src.data.orm import CampaignJobORM  # noqa: F401

    engine = create_engine("sqlite:///" + tempfile.mktemp(suffix="_campaign_test.db"))
    Base.metadata.create_all(engine)

    store = CampaignJobStore()
    store._factory = sessionmaker(bind=engine, expire_on_commit=False)

    for tenant, cid in (("acme", str(uuid.uuid4())), ("globex", str(uuid.uuid4()))):
        store.create(
            cid,
            name=f"campaign-{tenant}",
            provider="groq",
            model="openai/gpt-oss-120b",
            attack_profile="quick_scan",
            max_rounds=2,
            request_json={"name": f"campaign-{tenant}"},
            tenant_id=tenant,
        )

    acme_jobs = store.list_jobs(tenant_id="acme")
    globex_jobs = store.list_jobs(tenant_id="globex")
    assert {j["name"] for j in acme_jobs} == {"campaign-acme"}
    assert {j["name"] for j in globex_jobs} == {"campaign-globex"}
    # Cross-tenant get returns None (ownership enforced).
    globex_id = globex_jobs[0]["id"]
    assert store.get(globex_id, tenant_id="acme") is None
    assert store.get(globex_id, tenant_id="globex") is not None
