"""WS-3.1 Phase 3: admin cross-tenant view (explicitly admin-gated)."""

import tempfile
import uuid

import pytest
from src.api.routes.admin import _require_admin


def test_require_admin_allows_admin_role() -> None:
    from starlette.requests import Request as StarletteRequest

    request = StarletteRequest({"type": "http", "method": "GET", "path": "/api/v1/admin/tenants"})
    request.state.role = "admin"
    _require_admin(request)  # must not raise


@pytest.mark.parametrize("role", ["analyst", "redteam", "readonly", None])
def test_require_admin_rejects_non_admin(role) -> None:
    from fastapi import HTTPException
    from starlette.requests import Request as StarletteRequest

    request = StarletteRequest({"type": "http", "method": "GET", "path": "/api/v1/admin/tenants"})
    if role is not None:
        request.state.role = role
    with pytest.raises(HTTPException) as exc:
        _require_admin(request)
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_admin_tenants_returns_per_tenant_counts(monkeypatch) -> None:
    """Rows for two tenants surface as separate footprint entries."""
    from sqlalchemy import create_engine
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from sqlalchemy.orm import sessionmaker
    from src.api.routes.admin import admin_tenants
    from src.core.config import settings
    from src.data.db import Base
    from src.data.orm import (  # noqa: F401
        AlertORM,
        EventEvaluationORM,
        SessionORM,
        ToolCallEventORM,
    )
    from starlette.requests import Request as StarletteRequest

    monkeypatch.setattr(settings, "ENVIRONMENT", "integration_test")
    db_path = tempfile.mktemp(suffix="_admin_test.db")
    sync_engine = create_engine(f"sqlite:///{db_path}")
    async_engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    Base.metadata.create_all(sync_engine)
    sync_factory = sessionmaker(bind=sync_engine, expire_on_commit=False)
    with sync_factory() as s:
        s.add_all(
            [
                SessionORM(id=str(uuid.uuid4()), agent_id="a", tenant_id="acme"),
                SessionORM(id=str(uuid.uuid4()), agent_id="b", tenant_id="globex"),
                SessionORM(id=str(uuid.uuid4()), agent_id="c", tenant_id="acme"),
                AlertORM(
                    id=str(uuid.uuid4()), session_id=str(uuid.uuid4()), agent_id="a",
                    severity="HIGH", title="t", message="m", channel="WEBHOOK",
                    tenant_id="acme",
                ),
            ]
        )
        s.commit()

    async_factory = async_sessionmaker(bind=async_engine, expire_on_commit=False)
    async with async_factory() as db:
        request = StarletteRequest({"type": "http", "method": "GET", "path": "/api/v1/admin/tenants"})
        request.state.role = "admin"
        result = await admin_tenants(request, db)
    await async_engine.dispose()

    by_id = {t["tenant_id"]: t for t in result["tenants"]}
    assert by_id["acme"]["sessions"] == 2
    assert by_id["acme"]["alerts"] == 1
    assert by_id["globex"]["sessions"] == 1
    assert by_id["globex"]["alerts"] == 0
    assert result["total_tenants"] == 2
