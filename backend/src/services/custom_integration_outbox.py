"""Encrypted durable outbox for custom-integration delivery.

Rows are created before the worker is signalled. The source event is encrypted
at rest only while delivery is pending or a dead-letter is eligible for replay;
after a successful delivery its ciphertext is erased and the digest-only ledger
remains as evidence.
"""

from __future__ import annotations

import hashlib
import json
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import create_engine, delete, select
from sqlalchemy.orm import sessionmaker

from src.core.config import settings
from src.data.orm import CustomIntegrationOutboxORM
from src.utils.crypto import decrypt_secret, encrypt_secret


@dataclass(frozen=True)
class PendingDelivery:
    id: str
    tenant_id: str
    integration_name: str
    event_type: str
    delivery_id: str
    correlation_id: str
    payload_sha256: str
    event: dict[str, object]


def _engine():
    url = settings.SYNC_DATABASE_URL
    if settings.USE_SQLITE and "sqlite" not in url:
        url = "sqlite:///./data/artsa.db"
    return create_engine(url, echo=False)


def _factory(engine):
    CustomIntegrationOutboxORM.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def enqueue(
    *,
    tenant_id: str,
    integration_name: str,
    event_type: str,
    delivery_id: str,
    correlation_id: str,
    payload_sha256: str,
    event: dict[str, object],
) -> str:
    """Persist an idempotent encrypted pending delivery and return its row ID."""
    event_ciphertext = encrypt_secret(
        json.dumps(event, sort_keys=True, separators=(",", ":"), default=str), settings.SECRET_KEY
    )
    engine = _engine()
    try:
        factory = _factory(engine)
        with factory() as session:
            row = session.execute(
                select(CustomIntegrationOutboxORM).where(
                    CustomIntegrationOutboxORM.tenant_id == tenant_id,
                    CustomIntegrationOutboxORM.integration_name == integration_name,
                    CustomIntegrationOutboxORM.delivery_id == delivery_id,
                )
            ).scalar_one_or_none()
            if row is None:
                row = CustomIntegrationOutboxORM(
                    id=str(uuid.uuid4()),
                    tenant_id=tenant_id,
                    integration_name=integration_name,
                    event_type=event_type,
                    delivery_id=delivery_id,
                    correlation_id=correlation_id,
                    payload_sha256=payload_sha256,
                    event_ciphertext=event_ciphertext,
                    status="PENDING",
                )
                session.add(row)
            session.commit()
            return row.id
    finally:
        engine.dispose()


def pending_ids(limit: int = 500) -> list[str]:
    """Load outstanding work at startup; pending records survive queue loss."""
    engine = _engine()
    try:
        factory = _factory(engine)
        with factory() as session:
            return list(
                session.execute(
                    select(CustomIntegrationOutboxORM.id)
                    .where(CustomIntegrationOutboxORM.status == "PENDING")
                    .order_by(CustomIntegrationOutboxORM.created_at)
                    .limit(max(1, limit))
                ).scalars()
            )
    finally:
        engine.dispose()


def claim(delivery_row_id: str) -> PendingDelivery | None:
    """Claim one pending row and decrypt the event only in the worker process."""
    engine = _engine()
    try:
        factory = _factory(engine)
        with factory() as session:
            row = session.get(CustomIntegrationOutboxORM, delivery_row_id)
            if row is None or row.status != "PENDING" or not row.event_ciphertext:
                return None
            try:
                event = json.loads(decrypt_secret(row.event_ciphertext, settings.SECRET_KEY))
            except Exception:
                row.status = "DEAD_LETTER"
                row.failure_code = "PAYLOAD_DECRYPT_FAILED"
                row.updated_at = datetime.now(UTC)
                session.commit()
                return None
            if not isinstance(event, dict):
                row.status = "DEAD_LETTER"
                row.failure_code = "PAYLOAD_INVALID"
                row.updated_at = datetime.now(UTC)
                session.commit()
                return None
            row.status = "PROCESSING"
            row.updated_at = datetime.now(UTC)
            session.commit()
            return PendingDelivery(
                id=row.id,
                tenant_id=row.tenant_id,
                integration_name=row.integration_name,
                event_type=row.event_type,
                delivery_id=row.delivery_id,
                correlation_id=row.correlation_id,
                payload_sha256=row.payload_sha256,
                event=event,
            )
    finally:
        engine.dispose()


def finish(delivery_row_id: str, *, delivered: bool, attempt_count: int, failure_code: str | None) -> None:
    """Finalize a claim; erase ciphertext on success, retain it only for replay."""
    engine = _engine()
    try:
        factory = _factory(engine)
        with factory() as session:
            row = session.get(CustomIntegrationOutboxORM, delivery_row_id)
            if row is None:
                return
            now = datetime.now(UTC)
            row.attempt_count += max(1, attempt_count)
            row.status = "DELIVERED" if delivered else "DEAD_LETTER"
            row.failure_code = None if delivered else failure_code
            row.delivered_at = now if delivered else None
            row.updated_at = now
            if delivered:
                row.event_ciphertext = None
            session.commit()
    finally:
        engine.dispose()


def requeue(*, delivery_row_id: str, tenant_id: str, integration_name: str) -> bool:
    """Return a tenant-owned dead letter to pending state for explicit replay."""
    engine = _engine()
    try:
        factory = _factory(engine)
        with factory() as session:
            row = session.get(CustomIntegrationOutboxORM, delivery_row_id)
            if (
                row is None
                or row.tenant_id != tenant_id
                or row.integration_name != integration_name
                or row.status != "DEAD_LETTER"
                or not row.event_ciphertext
            ):
                return False
            row.status = "PENDING"
            row.failure_code = None
            row.updated_at = datetime.now(UTC)
            session.commit()
            return True
    finally:
        engine.dispose()


def prune_expired_dead_letters(retention_days: int) -> int:
    """Delete expired replay ciphertext while preserving the delivery ledger."""
    safe_days = max(1, int(retention_days))
    cutoff = datetime.now(UTC).timestamp() - (safe_days * 86_400)
    cutoff_time = datetime.fromtimestamp(cutoff, tz=UTC)
    engine = _engine()
    try:
        factory = _factory(engine)
        with factory() as session:
            result = session.execute(
                delete(CustomIntegrationOutboxORM).where(
                    CustomIntegrationOutboxORM.status == "DEAD_LETTER",
                    CustomIntegrationOutboxORM.updated_at < cutoff_time,
                )
            )
            session.commit()
            return int(result.rowcount or 0)
    finally:
        engine.dispose()


def event_digest(event: dict[str, object]) -> str:
    """Hash event identity without exposing its serialized content."""
    return hashlib.sha256(
        json.dumps(event, sort_keys=True, separators=(",", ":"), default=str).encode("utf-8")
    ).hexdigest()
