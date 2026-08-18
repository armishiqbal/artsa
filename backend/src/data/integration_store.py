"""DB-backed store for user-defined outbound integration connectors.

Secrets (auth tokens, API keys, HMAC keys) are encrypted at rest with the
platform SECRET_KEY, mirroring :mod:`src.data.provider_store`. The dispatch
engine reads connectors through :mod:`src.services.custom_integration_registry`,
which caches the store contents in memory (decrypted); this module only handles
persistence and never returns plaintext secrets to callers unless they
explicitly opt in via ``include_secrets=True`` (internal use only).
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.data.orm import CustomIntegrationORM
from src.utils.crypto import decrypt_secret, encrypt_secret

_SECRET_FIELDS = (
    "description",
    "method",
    "target_url",
    "auth_type",
    "headers",
    "payload_template",
    "event_types",
    "risk_threshold",
    "enabled",
    "retries",
    "timeout",
)


def _mask(value: str) -> str:
    """Return a masked secret for API responses (never the real value)."""
    if not value:
        return ""
    if len(value) <= 8:
        return "****"
    return f"{value[:4]}...{value[-4:]}"


def _row_to_dict(row: CustomIntegrationORM, include_secrets: bool = False) -> dict[str, Any]:
    data: dict[str, Any] = {
        "id": row.id,
        "name": row.name,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }
    for field in _SECRET_FIELDS:
        data[field] = getattr(row, field, None)

    # Decrypt secret names for display + raw values only for internal consumers.
    decrypted: dict[str, str] = {}
    for name, ciphertext in (row.secrets or {}).items():
        if not ciphertext:
            continue
        try:
            decrypted[name] = decrypt_secret(str(ciphertext), settings.SECRET_KEY)
        except Exception:
            decrypted[name] = ""
    data["secrets_masked"] = {name: _mask(value) for name, value in decrypted.items()}
    data["has_secrets"] = bool(decrypted)
    if include_secrets:
        data["secrets"] = decrypted
    return data


async def list_integrations(
    session: AsyncSession, include_secrets: bool = False, tenant_id: str | None = None
) -> list[dict[str, Any]]:
    query = select(CustomIntegrationORM)
    if tenant_id:
        query = query.where(CustomIntegrationORM.tenant_id == tenant_id)
    rows = (
        await session.execute(query.order_by(CustomIntegrationORM.name))
    ).scalars().all()
    return [_row_to_dict(r, include_secrets=include_secrets) for r in rows]


async def get_integration(
    session: AsyncSession,
    name: str,
    include_secrets: bool = True,
    tenant_id: str | None = None,
) -> dict[str, Any] | None:
    query = select(CustomIntegrationORM).where(CustomIntegrationORM.name == name)
    if tenant_id:
        query = query.where(CustomIntegrationORM.tenant_id == tenant_id)
    row = (
        await session.execute(query)
    ).scalar_one_or_none()
    return _row_to_dict(row, include_secrets=include_secrets) if row else None


def slugify(name: str) -> str:
    """Normalize a connector name into a routing slug (like provider names)."""
    return name.strip().lower().replace(" ", "-")


async def upsert_integration(
    session: AsyncSession,
    *,
    name: str,
    description: str | None = None,
    method: str = "POST",
    target_url: str,
    auth_type: str = "none",
    headers: dict[str, Any] | None = None,
    payload_template: str | None = None,
    event_types: list[str] | None = None,
    risk_threshold: float = 0.0,
    enabled: bool = True,
    retries: int = 3,
    timeout: float = 10.0,
    secrets: dict[str, str] | None = None,
    tenant_id: str = "default_tenant",
) -> dict[str, Any]:
    """Create or update a connector. Returns the stored (masked) dict.

    Every value in ``secrets`` is encrypted at rest. This is a full-field
    replace (like ``upsert_provider``); route handlers are responsible for
    merging any existing secrets they want preserved before calling it.
    """
    name = slugify(name)
    if not name:
        raise ValueError("integration name is required")
    if not (target_url or "").strip():
        raise ValueError("integration target_url is required")

    encrypted = {k: encrypt_secret(v, settings.SECRET_KEY) for k, v in (secrets or {}).items() if v}

    query = select(CustomIntegrationORM).where(CustomIntegrationORM.name == name)
    if tenant_id:
        query = query.where(CustomIntegrationORM.tenant_id == tenant_id)
    row = (
        await session.execute(query)
    ).scalar_one_or_none()

    if row is None:
        row = CustomIntegrationORM(
            id=str(uuid.uuid4()),
            name=name,
            description=(description or "").strip() or None,
            method=method.strip().upper() or "POST",
            target_url=target_url.strip(),
            auth_type=auth_type.strip().lower() or "none",
            headers=headers or {},
            payload_template=(payload_template or "").strip() or None,
            event_types=event_types or [],
            risk_threshold=float(risk_threshold),
            enabled=enabled,
            retries=int(retries),
            timeout=float(timeout),
            secrets=encrypted,
            tenant_id=tenant_id or "default_tenant",
        )
        session.add(row)
    else:
        row.description = (description or "").strip() or None
        row.method = method.strip().upper() or "POST"
        row.target_url = target_url.strip()
        row.auth_type = auth_type.strip().lower() or "none"
        row.headers = headers or {}
        row.payload_template = (payload_template or "").strip() or None
        row.event_types = event_types or []
        row.risk_threshold = float(risk_threshold)
        row.enabled = enabled
        row.retries = int(retries)
        row.timeout = float(timeout)
        row.secrets = encrypted

    await session.commit()
    await session.refresh(row)
    return _row_to_dict(row)


async def delete_integration(session: AsyncSession, name: str, tenant_id: str | None = None) -> bool:
    query = delete(CustomIntegrationORM).where(CustomIntegrationORM.name == name)
    if tenant_id:
        query = query.where(CustomIntegrationORM.tenant_id == tenant_id)
    result = await session.execute(query)
    await session.commit()
    return result.rowcount > 0
