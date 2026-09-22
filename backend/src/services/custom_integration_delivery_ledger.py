"""Durable, digest-only terminal evidence for outbound custom integrations.

This is intentionally a *delivery ledger*, not a raw webhook archive. It
records whether the worker delivered an event or exhausted its bounded retries,
while retaining only a payload hash. A terminal failure is a durable
``DEAD_LETTER`` signal for operators; replay needs the original upstream event
and is therefore intentionally not fabricated from retained sensitive payloads.
"""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime

from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from src.core.config import settings
from src.data.orm import CustomIntegrationDeliveryORM

logger = logging.getLogger(__name__)


def record_delivery_outcome(
    *,
    tenant_id: str,
    integration_name: str,
    event_type: str,
    delivery_id: str,
    correlation_id: str,
    payload_sha256: str,
    delivered: bool,
    attempt_count: int,
    failure_code: str | None,
) -> None:
    """Upsert a terminal delivery result without persisting raw event content.

    This runs inside the existing worker, never the ingest request path. The
    migration creates the table in production; ``create_all`` preserves the
    project convention that development SQLite installations remain usable.
    """
    url = settings.SYNC_DATABASE_URL
    if settings.USE_SQLITE and "sqlite" not in url:
        url = "sqlite:///./data/artsa.db"
    engine = create_engine(url, echo=False)
    try:
        CustomIntegrationDeliveryORM.metadata.create_all(engine)
        factory = sessionmaker(bind=engine, expire_on_commit=False)
        now = datetime.now(UTC)
        with factory() as session:
            row = session.execute(
                select(CustomIntegrationDeliveryORM).where(
                    CustomIntegrationDeliveryORM.tenant_id == tenant_id,
                    CustomIntegrationDeliveryORM.integration_name == integration_name,
                    CustomIntegrationDeliveryORM.delivery_id == delivery_id,
                )
            ).scalar_one_or_none()
            if row is None:
                row = CustomIntegrationDeliveryORM(
                    id=str(uuid.uuid4()),
                    tenant_id=tenant_id,
                    integration_name=integration_name,
                    event_type=event_type,
                    delivery_id=delivery_id,
                    correlation_id=correlation_id,
                    payload_sha256=payload_sha256,
                    status="DELIVERED" if delivered else "DEAD_LETTER",
                    attempt_count=max(1, attempt_count),
                    failure_code=None if delivered else failure_code,
                    delivered_at=now if delivered else None,
                )
                session.add(row)
            else:
                row.event_type = event_type
                row.correlation_id = correlation_id
                row.payload_sha256 = payload_sha256
                row.status = "DELIVERED" if delivered else "DEAD_LETTER"
                row.attempt_count = max(1, attempt_count)
                row.failure_code = None if delivered else failure_code
                row.delivered_at = now if delivered else None
                row.updated_at = now
            session.commit()
    finally:
        engine.dispose()
