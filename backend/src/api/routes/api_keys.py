"""Partner API keys — Lakera-style secrets partners paste into their systems.

- ``GET  /api-keys``           — list keys (masked)
- ``POST /api-keys``           — create key (returns plaintext **once**)
- ``DELETE /api-keys/{id}``    — revoke key
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.rbac import Role
from src.data.db import get_async_session
from src.data.partner_api_key_store import create_key, list_keys, revoke_key

router = APIRouter(tags=["API Keys"])


class CreateApiKeyPayload(BaseModel):
    name: str = Field(default="partner-key", max_length=128)
    role: str = Field(default="analyst", description="analyst (ingest) | redteam | readonly")


def _require_admin(request: Request) -> None:
    role = getattr(request.state, "role", None)
    if role is not None and role != Role.ADMIN:
        raise HTTPException(status_code=403, detail="Admin role required to manage API keys")


@router.get("/api-keys")
async def api_keys_list(
    request: Request,
    session: AsyncSession = Depends(get_async_session),
) -> dict[str, Any]:
    _require_admin(request)
    rows = await list_keys(session)
    for r in rows:
        r.pop("key_hash", None)
    return {
        "keys": rows,
        "count": len(rows),
        "note": "Partners send X-API-Key on POST /api/v1/ingest. Keys are shown once at creation.",
    }


@router.post("/api-keys", status_code=201)
async def api_keys_create(
    request: Request,
    payload: CreateApiKeyPayload,
    session: AsyncSession = Depends(get_async_session),
) -> dict[str, Any]:
    _require_admin(request)
    tenant_id = (
        request.headers.get("X-Tenant-ID")
        or getattr(request.state, "tenant_id", None)
        or "default_org"
    )
    created = await create_key(
        session,
        name=payload.name,
        role=payload.role,
        tenant_id=str(tenant_id),
    )
    return {
        "status": "ok",
        "key": created,
        "warning": "Copy api_key now — it will not be shown again.",
    }


@router.delete("/api-keys/{key_id}")
async def api_keys_delete(
    key_id: str,
    request: Request,
    session: AsyncSession = Depends(get_async_session),
) -> dict[str, Any]:
    _require_admin(request)
    ok = await revoke_key(session, key_id)
    if not ok:
        raise HTTPException(status_code=404, detail="API key not found")
    return {"status": "ok", "deleted": key_id}
