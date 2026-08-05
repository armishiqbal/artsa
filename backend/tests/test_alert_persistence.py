"""Repository + store tests for persistent alert storage."""

import asyncio
import uuid

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from src.core.models.alerts import Alert, AlertRule
from src.data.db import Base
from src.data.orm import AlertORM, AlertRuleORM  # noqa: F401  (register tables on metadata)
from src.data.repositories.alerts import AlertRepository, AlertRuleRepository
from src.services import alert_store


async def _make_session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    return factory, engine


def _alert(severity: str = "HIGH", delivered: bool = False) -> Alert:
    return Alert(
        id=uuid.uuid4(),
        session_id=uuid.uuid4(),
        agent_id="agent-persist-01",
        severity=severity,
        title="Persisted Alert",
        message="Agent agent-persist-01 · risk 85.0 · recommended KILL",
        channel="WEBHOOK",
        delivered=delivered,
    )


def test_alert_created_and_listed() -> None:
    async def _run():
        session_factory, engine = await _make_session()
        async with session_factory() as session:
            repo = AlertRepository(session)
            alert = _alert()
            await repo.create_alert(alert)

            listed = await repo.list_alerts()
            assert len(listed) == 1
            assert listed[0].id == alert.id
            assert listed[0].severity == "HIGH"
            assert listed[0].delivered is False
            assert listed[0].triggered_at is not None
        await engine.dispose()

    asyncio.run(_run())


def test_alert_filters_by_severity_and_session() -> None:
    async def _run():
        session_factory, engine = await _make_session()
        async with session_factory() as session:
            repo = AlertRepository(session)
            critical = _alert(severity="CRITICAL")
            high = _alert(severity="HIGH")
            await repo.create_alert(critical)
            await repo.create_alert(high)

            crits = await repo.list_alerts(severity="CRITICAL")
            assert [a.id for a in crits] == [critical.id]

            scoped = await repo.list_alerts(session_id=str(high.session_id))
            assert [a.id for a in scoped] == [high.id]
        await engine.dispose()

    asyncio.run(_run())


def test_alert_mark_delivered_persists() -> None:
    async def _run():
        session_factory, engine = await _make_session()
        async with session_factory() as session:
            repo = AlertRepository(session)
            alert = _alert()
            await repo.create_alert(alert)

            await repo.mark_delivered(alert.id)
            listed = await repo.list_alerts()
            assert listed[0].delivered is True
        await engine.dispose()

    asyncio.run(_run())


def test_webhook_rule_upsert_and_list() -> None:
    async def _run():
        session_factory, engine = await _make_session()
        async with session_factory() as session:
            repo = AlertRuleRepository(session)
            rule = AlertRule(
                id=str(uuid.uuid4()),
                tenant_id="default_tenant",
                risk_threshold=80.0,
                channel="WEBHOOK",
                target_url="https://hooks.example.com/artsa",
                enabled=True,
            )
            await repo.upsert_rule(rule)

            listed = await repo.list_rules()
            assert len(listed) == 1
            assert listed[0].target_url == "https://hooks.example.com/artsa"
            assert listed[0].risk_threshold == 80.0

            # Upsert updates the existing row (no duplicates).
            rule.risk_threshold = 90.0
            await repo.upsert_rule(rule)
            listed = await repo.list_rules()
            assert len(listed) == 1
            assert listed[0].risk_threshold == 90.0
        await engine.dispose()

    asyncio.run(_run())


def test_store_persist_and_load_state_round_trip() -> None:
    async def _run():
        session_factory, engine = await _make_session()
        async with session_factory() as session:
            # 1. Persist an alert + rule through the store helpers.
            alert = _alert()
            await alert_store.persist_alert(session, alert)
            rule = AlertRule(
                id=str(uuid.uuid4()),
                tenant_id="default_tenant",
                risk_threshold=70.0,
                channel="WEBHOOK",
                target_url="https://hooks.example.com/roundtrip",
                enabled=True,
            )
            await alert_store.persist_webhook_rule(session, rule)

        # 2. Simulate a restart: fresh session, load persisted state into memory.
        async with session_factory() as session:
            await alert_store.load_persisted_state(session)

        assert len(alert_store.list_alerts()) == 1
        assert alert_store.list_alerts()[0].id == alert.id
        assert len(alert_store.get_webhook_rules()) == 1
        assert alert_store.get_webhook_rules()[0].target_url == "https://hooks.example.com/roundtrip"

        # Clean up the module-level hot store for other tests.
        alert_store.load_persisted_alerts([])
        alert_store.seed_webhook_rules([])
        await engine.dispose()

    asyncio.run(_run())
