"""Durable, digest-only evidence tests for custom integration delivery."""

from __future__ import annotations

from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from src.core.config import settings
from src.data.orm import CustomIntegrationDeliveryORM
from src.services.custom_integration_delivery_ledger import record_delivery_outcome


def test_delivery_ledger_is_metadata_only_and_upserts(tmp_path, monkeypatch):
    database_url = f"sqlite:///{tmp_path / 'delivery_ledger.db'}"
    monkeypatch.setattr(settings, "SYNC_DATABASE_URL", database_url)
    monkeypatch.setattr(settings, "USE_SQLITE", True)

    record_delivery_outcome(
        tenant_id="tenant-a",
        integration_name="siem",
        event_type="alert",
        delivery_id="delivery-1",
        correlation_id="trace-1",
        payload_sha256="a" * 64,
        delivered=False,
        attempt_count=3,
        failure_code="DELIVERY_ATTEMPTS_EXHAUSTED",
    )
    record_delivery_outcome(
        tenant_id="tenant-a",
        integration_name="siem",
        event_type="alert",
        delivery_id="delivery-1",
        correlation_id="trace-1",
        payload_sha256="a" * 64,
        delivered=True,
        attempt_count=1,
        failure_code=None,
    )

    engine = create_engine(database_url)
    try:
        with sessionmaker(bind=engine)() as session:
            row = session.execute(select(CustomIntegrationDeliveryORM)).scalar_one()
        assert row.status == "DELIVERED"
        assert row.attempt_count == 1
        assert row.failure_code is None
        columns = set(CustomIntegrationDeliveryORM.__table__.columns.keys())
        assert {"payload_sha256", "delivery_id", "correlation_id"} <= columns
        assert "payload" not in columns
        assert "headers" not in columns
        assert "secrets" not in columns
    finally:
        engine.dispose()
