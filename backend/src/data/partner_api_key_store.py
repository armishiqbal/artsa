"""Persistence for partner ingest API keys (Lakera-style)."""

from __future__ import annotations

import secrets
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.data.orm import PartnerApiKeyORM
from src.services import partner_key_registry


def _mask(prefix: str, last4: str) -> str:
    return f"{prefix}{'•' * 16}{last4}"


def _row_public(row: PartnerApiKeyORM) -> dict[str, Any]:
    return {
        "id": row.id,
        "name": row.name,
        "key_prefix": row.key_prefix,
        "key_last4": row.key_last4,
        "api_key_masked": _mask(row.key_prefix, row.key_last4),
        "role": row.role,
        "tenant_id": row.tenant_id,
        "enabled": row.enabled,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "last_used_at": row.last_used_at.isoformat() if row.last_used_at else None,
        "key_hash": row.key_hash,
    }


async def list_keys(session: AsyncSession, *, tenant_id: str | None = None) -> list[dict[str, Any]]:
    stmt = select(PartnerApiKeyORM).order_by(PartnerApiKeyORM.created_at.desc())
    if tenant_id:
        stmt = stmt.where(PartnerApiKeyORM.tenant_id == tenant_id)
    rows = (await session.execute(stmt)).scalars().all()
    return [_row_public(r) for r in rows]


async def create_key(
    session: AsyncSession,
    *,
    name: str,
    role: str = "analyst",
    tenant_id: str = "default_org",
) -> dict[str, Any]:
    """Create a partner key. Returns public fields + one-time ``api_key`` plaintext."""
    name = (name or "partner-key").strip()[:128] or "partner-key"
    if role not in {"analyst", "redteam", "readonly", "admin"}:
        role = "analyst"

    raw = f"artsa_live_{secrets.token_hex(20)}"
    key_hash = partner_key_registry.hash_api_key(raw)
    prefix = "artsa_live_"
    last4 = raw[-4:]

    row = PartnerApiKeyORM(
        id=str(uuid.uuid4()),
        name=name,
        key_prefix=prefix,
        key_hash=key_hash,
        key_last4=last4,
        role=role,
        tenant_id=tenant_id or "default_org",
        enabled=True,
        created_at=datetime.now(UTC),
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)

    public = _row_public(row)
    partner_key_registry.upsert(public)
    public["api_key"] = raw  # shown once
    # Don't leak hash to clients
    public.pop("key_hash", None)
    return public


async def revoke_key(session: AsyncSession, key_id: str) -> bool:
    row = (
        await session.execute(select(PartnerApiKeyORM).where(PartnerApiKeyORM.id == key_id))
    ).scalar_one_or_none()
    if row is None:
        return False
    partner_key_registry.remove_by_hash(row.key_hash)
    await session.delete(row)
    await session.commit()
    return True


async def load_registry(session: AsyncSession) -> int:
    """Load all enabled keys into the in-memory auth registry."""
    rows = (
        await session.execute(select(PartnerApiKeyORM).where(PartnerApiKeyORM.enabled.is_(True)))
    ).scalars().all()
    partner_key_registry.replace_all([_row_public(r) for r in rows])
    return len(rows)
