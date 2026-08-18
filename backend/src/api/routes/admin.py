"""Admin cross-tenant view — WS-3.1 Phase 3.

Explicitly admin-gated (the RBAC prefix rules grant `GET:` to readonly, so the
route checks ``request.state.role`` itself rather than relying on path rules).
Returns per-tenant row counts across the tenant-scoped tables so an operator
can see org footprints at a glance.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.data.db import get_async_session
from src.data.orm import AlertORM, EventEvaluationORM, SessionORM

router = APIRouter(tags=["Admin"])


def _require_admin(request: Request) -> None:
    if getattr(request.state, "role", None) != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")


async def _tenant_counts(
    session: AsyncSession, model: Any, column_name: str
) -> dict[str, int]:
    column = getattr(model, column_name)
    rows = await session.execute(
        select(column, func.count()).group_by(column)
    )
    return {str(tenant): int(count) for tenant, count in rows.all()}


@router.get("/admin/tenants")
async def admin_tenants(
    request: Request,
    db: AsyncSession = Depends(get_async_session),
) -> dict[str, Any]:
    """Per-tenant footprint: session / alert / evaluation counts."""
    _require_admin(request)

    sessions = await _tenant_counts(db, SessionORM, "tenant_id")
    alerts = await _tenant_counts(db, AlertORM, "tenant_id")
    evaluations = await _tenant_counts(db, EventEvaluationORM, "tenant_id")

    tenant_ids = set(sessions) | set(alerts) | set(evaluations)
    tenants = [
        {
            "tenant_id": tid,
            "sessions": sessions.get(tid, 0),
            "alerts": alerts.get(tid, 0),
            "evaluations": evaluations.get(tid, 0),
        }
        for tid in sorted(tenant_ids)
    ]
    return {"tenants": tenants, "total_tenants": len(tenants)}
