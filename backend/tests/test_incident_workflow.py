"""WS-3.3: incident workflow — session release/close + alert acknowledge/resolve."""

import uuid

from src.core.models.sessions import Session
from src.services.session_tracker import SessionTracker


def _session(status: str = "ACTIVE") -> Session:
    return Session(id=uuid.uuid4(), agent_id="agent-x", tenant_id="acme", status=status)  # type: ignore[arg-type]


def _tracker_with(session: Session) -> SessionTracker:
    tracker = SessionTracker()
    tracker.active_sessions[str(session.id)] = session
    tracker.session_events[str(session.id)] = []
    return tracker


# ── Session release / close ─────────────────────────────────────────────────


def test_release_restores_quarantined_to_active():
    session = _session("QUARANTINED")
    tracker = _tracker_with(session)
    tracker.apply_action(session.id, "RELEASE")
    assert session.status == "ACTIVE"
    assert session.ended_at is None


def test_release_restores_breached_to_active():
    session = _session("BREACHED")
    tracker = _tracker_with(session)
    tracker.apply_action(session.id, "RELEASE")
    assert session.status == "ACTIVE"
    assert session.ended_at is None


def test_close_ends_contained_session():
    session = _session("QUARANTINED")
    tracker = _tracker_with(session)
    tracker.apply_action(session.id, "CLOSE")
    assert session.status == "CLOSED"
    assert session.ended_at is not None


def test_release_then_ingest_not_blocked():
    """A released session is no longer 'contained', so ingest fail-closed allows it."""
    session = _session("QUARANTINED")
    tracker = _tracker_with(session)
    tracker.apply_action(session.id, "RELEASE")
    assert not tracker.is_contained(session.id)


def test_release_persists_via_repo(monkeypatch):
    import tempfile

    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from src.core.config import settings
    from src.data.db import Base
    from src.data.orm import SessionORM
    from src.data.repositories.sessions import SessionRepository

    monkeypatch.setattr(settings, "ENVIRONMENT", "integration_test")
    engine = create_engine("sqlite:///" + tempfile.mktemp(suffix="_sessions_test.db"))
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    with factory() as s:
        s.add(SessionORM(id="00000000-0000-0000-0000-000000000aaa", agent_id="a", tenant_id="acme", status="QUARANTINED"))
        s.commit()

    import asyncio

    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    async def run():
        async_engine = create_async_engine("sqlite+aiosqlite:///" + engine.url.database)
        async_factory = async_sessionmaker(bind=async_engine, expire_on_commit=False)
        async with async_factory() as db:
            repo = SessionRepository(db)
            updated = await repo.apply_action(uuid.UUID("00000000-0000-0000-0000-000000000aaa"), "RELEASE")
            assert updated is not None and updated.status == "ACTIVE"
        await async_engine.dispose()

    asyncio.run(run())


# ── Alert acknowledge / resolve ─────────────────────────────────────────────


def test_alert_defaults_to_new():
    from src.core.models.alerts import Alert

    alert = Alert(session_id=uuid.uuid4(), agent_id="a", severity="HIGH", title="t", message="m", channel="WEBHOOK")
    assert alert.status == "NEW"


def test_in_memory_alert_status_update():
    from src.core.models.alerts import Alert
    from src.services import alert_store

    alert = Alert(session_id=uuid.uuid4(), agent_id="a", severity="HIGH", title="t", message="m", channel="WEBHOOK")
    alert_store.append_alert(alert)
    assert alert_store.update_alert_status(alert.id, "ACKNOWLEDGED") is True
    assert alert_store.list_alerts(status="ACKNOWLEDGED")[0].id == alert.id
    assert alert_store.update_alert_status(uuid.uuid4(), "RESOLVED") is False


def test_persisted_alert_status_roundtrip(monkeypatch):
    import asyncio
    import tempfile

    from sqlalchemy import create_engine
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from sqlalchemy.orm import sessionmaker
    from src.core.config import settings
    from src.data.db import Base
    from src.data.orm import AlertORM
    from src.data.repositories.alerts import AlertRepository

    monkeypatch.setattr(settings, "ENVIRONMENT", "integration_test")
    db_path = tempfile.mktemp(suffix="_alerts_test.db")
    sync_engine = create_engine(f"sqlite:///{db_path}")
    async_engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    Base.metadata.create_all(sync_engine)
    sync_factory = sessionmaker(bind=sync_engine, expire_on_commit=False)
    with sync_factory() as s:
        s.add(
            AlertORM(
                id="00000000-0000-0000-0000-000000000aaa", session_id=str(uuid.uuid4()), agent_id="a", severity="HIGH",
                title="t", message="m", channel="WEBHOOK", status="NEW", tenant_id="acme",
            )
        )
        s.commit()

    async def run():
        async_factory = async_sessionmaker(bind=async_engine, expire_on_commit=False)
        async with async_factory() as db:
            repo = AlertRepository(db)
            assert await repo.update_status(uuid.UUID("00000000-0000-0000-0000-000000000aaa"), "RESOLVED") is True
            rows = await repo.list_alerts(status="RESOLVED", tenant_id="acme")
            assert len(rows) == 1 and rows[0].status == "RESOLVED"
        await async_engine.dispose()

    asyncio.run(run())
