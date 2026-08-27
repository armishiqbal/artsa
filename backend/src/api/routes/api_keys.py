"""API keys for customers using ARTSA as a service.

- ``GET  /api-keys``           — list keys (masked)
- ``POST /api-keys``           — create key (returns plaintext **once**)
- ``DELETE /api-keys/{id}``    — revoke key
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.rbac import Role
from src.data.db import get_async_session
from src.data.partner_api_key_store import create_key, list_keys, revoke_key

router = APIRouter(tags=["API Keys"])


class CreateApiKeyPayload(BaseModel):
    name: str = Field(default="customer-key", max_length=128)
    role: str = Field(default="analyst", description="analyst (ingest) | redteam | readonly")
    run_baseline: bool = Field(
        default=False,
        description="Phase 4: start a baseline quick scan after creating the key",
    )
    enable_weekly_baseline: bool = Field(
        default=False,
        description="Phase 4: enable a weekly baseline schedule for this tenant",
    )


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
        "note": "Customers send X-API-Key on POST /api/v1/ingest. Keys are shown once at creation.",
    }


@router.post("/api-keys", status_code=201)
async def api_keys_create(
    request: Request,
    payload: CreateApiKeyPayload,
    background_tasks: BackgroundTasks,
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
    extras: dict[str, Any] = {}
    if payload.enable_weekly_baseline:
        from src.data.baseline_schedule_store import baseline_schedule_store

        extras["schedule"] = baseline_schedule_store.upsert(
            tenant_id=str(tenant_id),
            enabled=True,
            interval_days=7,
            name=f"Weekly baseline · {payload.name}",
        )
    if payload.run_baseline:
        try:
            from src.api.routes.campaigns import _launch_baseline, _resolve_baseline_target
            from src.services.endpoint_quota import enforce_baseline_start_quota

            enforce_baseline_start_quota(str(tenant_id))
            provider, model = _resolve_baseline_target(None, None)
            extras["baseline"] = _launch_baseline(
                background_tasks=background_tasks,
                tenant_id=str(tenant_id),
                name=f"Onboard baseline · {payload.name}",
                provider=provider,
                model=model,
                max_rounds=3,
                use_llm_judge=False,
            )
        except HTTPException as exc:
            extras["baseline_error"] = exc.detail
        except Exception as exc:  # pragma: no cover
            extras["baseline_error"] = str(exc)

    return {
        "status": "ok",
        "key": created,
        "warning": "Copy api_key now — it will not be shown again.",
        **extras,
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
