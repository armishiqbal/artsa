"""WS-4.4 + WS-3.1 hardening: rate-limit enforcement + identity->tenant binding."""

import asyncio
import tempfile

# ── Rate limiting (WS-4.4) ───────────────────────────────────────────────────


def test_rate_limit_returns_429_after_budget():
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse
    from httpx import ASGITransport, AsyncClient
    from src.api.middleware.rate_limit import RateLimitMiddleware
    from starlette.requests import Request

    app = FastAPI()

    @app.get("/ok")
    async def ok(request: Request):
        return JSONResponse({"ok": True})

    wrapped = RateLimitMiddleware(app, requests_per_minute=2)

    async def run():
        transport = ASGITransport(app=wrapped)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            r1 = await client.get("/ok")
            r2 = await client.get("/ok")
            r3 = await client.get("/ok")
            return r1.status_code, r2.status_code, r3.status_code

    first, second, third = asyncio.run(run())
    assert first == 200 and second == 200
    assert third == 429, "third request within the same window must be rate-limited"


def test_rate_limit_per_tenant_key():
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse
    from httpx import ASGITransport, AsyncClient
    from src.api.middleware.rate_limit import RateLimitMiddleware

    app = FastAPI()

    @app.get("/ok")
    async def ok():
        return JSONResponse({"ok": True})

    wrapped = RateLimitMiddleware(app, requests_per_minute=1)

    async def run():
        transport = ASGITransport(app=wrapped)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            a1 = await client.get("/ok", headers={"X-Tenant-ID": "tenant-a"})
            a2 = await client.get("/ok", headers={"X-Tenant-ID": "tenant-a"})
            b1 = await client.get("/ok", headers={"X-Tenant-ID": "tenant-b"})
            return a1.status_code, a2.status_code, b1.status_code

    first, second, other = asyncio.run(run())
    assert first == 200
    assert second == 429, "tenant-a exhausted its budget"
    assert other == 200, "tenant-b has its own budget"


# ── Identity -> tenant binding (WS-3.1 hardening) ───────────────────────────


def test_register_stamps_user_tenant(monkeypatch):

    from sqlalchemy import create_engine
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from src.core.config import settings
    from src.data.db import Base
    from src.data.orm import UserORM  # noqa: F401
    from src.data.user_store import create_user

    monkeypatch.setattr(settings, "ENVIRONMENT", "integration_test")
    db_path = tempfile.mktemp(suffix="_users_tenant_test.db")
    sync_engine = create_engine(f"sqlite:///{db_path}")
    async_engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    Base.metadata.create_all(sync_engine)

    async def run():
        async_factory = async_sessionmaker(bind=async_engine, expire_on_commit=False)
        async with async_factory() as db:
            user = await create_user(
                db, email="ops@acme.com", password_hash="x", role="analyst", tenant_id="acme"
            )
            assert user.tenant_id == "acme"
            from src.data.user_store import get_user_by_email

            fetched = await get_user_by_email(db, "ops@acme.com")
            assert fetched is not None and fetched.tenant_id == "acme"
        await async_engine.dispose()

    asyncio.run(run())


def test_get_current_tenant_uses_user_home_not_header(monkeypatch):
    """A password-session bearer token overrides the caller-chosen header."""

    from sqlalchemy import create_engine
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from src.api.dependencies import get_current_tenant
    from src.core.config import settings
    from src.core.password_auth import create_session_token
    from src.data.db import Base
    from src.data.orm import UserORM  # noqa: F401
    from src.data.user_store import create_user

    monkeypatch.setattr(settings, "ENVIRONMENT", "integration_test")
    db_path = tempfile.mktemp(suffix="_tenant_bind_test.db")
    sync_engine = create_engine(f"sqlite:///{db_path}")
    async_engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    Base.metadata.create_all(sync_engine)

    async def run():
        async_factory = async_sessionmaker(bind=async_engine, expire_on_commit=False)
        async with async_factory() as db:
            user = await create_user(
                db, email="user@acme.com", password_hash="x", role="admin", tenant_id="acme"
            )
            token = create_session_token(user.id, user.email, user.role)
            # Caller lies with X-Tenant-ID: globex — the user's home tenant wins.
            tenant = await get_current_tenant(
                x_tenant_id="globex",
                authorization=f"Bearer {token}",
                db=db,
            )
            assert tenant == "acme", "bearer session must resolve the user's home tenant"
        await async_engine.dispose()

    asyncio.run(run())
