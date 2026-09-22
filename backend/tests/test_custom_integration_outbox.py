"""Encrypted outbox lifecycle tests for reliable custom-integration delivery."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import create_engine, update
from sqlalchemy.orm import sessionmaker
from src.core.config import settings
from src.data.orm import CustomIntegrationOutboxORM
from src.services.custom_integration_outbox import (
    claim,
    enqueue,
    finish,
    pending_ids,
    prune_expired_dead_letters,
    requeue,
)


def test_outbox_survives_queue_loss_and_erases_ciphertext_after_success(tmp_path, monkeypatch):
    database_url = f"sqlite:///{tmp_path / 'outbox.db'}"
    monkeypatch.setattr(settings, "SYNC_DATABASE_URL", database_url)
    monkeypatch.setattr(settings, "USE_SQLITE", True)
    event = {"event_id": "evt-1", "tenant_id": "tenant-a", "note": "private incident detail"}

    delivery_row_id = enqueue(
        tenant_id="tenant-a",
        integration_name="siem",
        event_type="alert",
        delivery_id="evt-1",
        correlation_id="trace-1",
        payload_sha256="c" * 64,
        event=event,
    )
    assert delivery_row_id in pending_ids()

    first_claim = claim(delivery_row_id)
    assert first_claim is not None
    assert first_claim.event == event
    finish(
        delivery_row_id,
        delivered=False,
        attempt_count=3,
        failure_code="DELIVERY_ATTEMPTS_EXHAUSTED",
    )

    assert requeue(
        delivery_row_id=delivery_row_id, tenant_id="tenant-a", integration_name="siem"
    )
    second_claim = claim(delivery_row_id)
    assert second_claim is not None
    finish(delivery_row_id, delivered=True, attempt_count=1, failure_code=None)

    engine = create_engine(database_url)
    try:
        with sessionmaker(bind=engine)() as session:
            row = session.get(CustomIntegrationOutboxORM, delivery_row_id)
            assert row is not None
            assert row.status == "DELIVERED"
            assert row.attempt_count == 4
            assert row.event_ciphertext is None
            assert row.failure_code is None
    finally:
        engine.dispose()


def test_prune_removes_only_expired_dead_letter_ciphertext(tmp_path, monkeypatch):
    database_url = f"sqlite:///{tmp_path / 'outbox_retention.db'}"
    monkeypatch.setattr(settings, "SYNC_DATABASE_URL", database_url)
    monkeypatch.setattr(settings, "USE_SQLITE", True)
    delivery_row_id = enqueue(
        tenant_id="tenant-a",
        integration_name="siem",
        event_type="alert",
        delivery_id="expired-delivery",
        correlation_id="trace-1",
        payload_sha256="d" * 64,
        event={"event_id": "expired-delivery"},
    )
    claim(delivery_row_id)
    finish(
        delivery_row_id,
        delivered=False,
        attempt_count=1,
        failure_code="DELIVERY_ATTEMPTS_EXHAUSTED",
    )
    engine = create_engine(database_url)
    try:
        with sessionmaker(bind=engine)() as session:
            session.execute(
                update(CustomIntegrationOutboxORM)
                .where(CustomIntegrationOutboxORM.id == delivery_row_id)
                .values(updated_at=datetime.now(UTC) - timedelta(days=31))
            )
            session.commit()
    finally:
        engine.dispose()

    assert prune_expired_dead_letters(30) == 1
