"""FastAPI Dependency Injection Providers."""

import logging
from collections.abc import AsyncGenerator

from fastapi import Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.data.db import get_async_session
from src.data.redis_client import RedisStreamProtocol, get_redis_stream_client
from src.services.event_processor import EventProcessor
from src.services.session_tracker import SessionTracker, session_tracker

logger = logging.getLogger(__name__)

_processor = EventProcessor()
_tracker = session_tracker


class MockAsyncSession:
    """Mock AsyncSession for test environments."""

    def add(self, instance: object) -> None:
        pass

    async def commit(self) -> None:
        pass

    async def flush(self) -> None:
        pass

    async def rollback(self) -> None:
        pass

    async def close(self) -> None:
        pass

    async def refresh(self, instance: object) -> None:
        pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield async database session (SQLite/Postgres) or mock in tests."""
    if settings.is_testing:
        yield MockAsyncSession()  # type: ignore[misc]
        return

    async for session in get_async_session():
        yield session


def get_redis() -> RedisStreamProtocol:
    return get_redis_stream_client()


def get_event_processor() -> EventProcessor:
    return _processor


def get_session_tracker() -> SessionTracker:
    return _tracker


async def _tenant_for_password_session(authorization: str | None) -> str | None:
    """Resolve a password session's tenant from the configured account store."""
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    try:
        from src.core.password_auth import decode_session_token
        from src.data.user_store import get_user_store

        claims = decode_session_token(authorization[7:].strip())
        subject = claims.get("sub") if claims else None
        if not subject:
            return None
        user = await get_user_store().get_user_by_id(str(subject))
        return user.tenant_id if user and user.tenant_id else None
    except Exception:
        logger.debug("Tenant resolution from password session failed", exc_info=True)
        return None


async def get_current_tenant(
    x_tenant_id: str | None = Header(None, alias="X-Tenant-ID"),
    x_api_key: str | None = Header(None, alias="X-API-Key"),
    authorization: str | None = Header(None, alias="Authorization"),
) -> str:
    """Resolve the effective tenant for the request.

    Hardening (WS-3.1): a password-session bearer token is authoritative — the
    user's home tenant comes from the account record, never from a caller-chosen
    header. Anonymous header/default tenancy is development-only; protected and
    production deployments reject requests without a valid tenant credential.
    """
    if authorization and authorization.lower().startswith("bearer "):
        tenant_id = await _tenant_for_password_session(authorization)
        if tenant_id:
            return tenant_id
        if settings.ENVIRONMENT == "production" or settings.ARTSA_REQUIRE_AUTH:
            raise HTTPException(status_code=401, detail="invalid authenticated tenant")
    if x_api_key:
        from src.services.partner_key_registry import resolve_metadata

        meta = resolve_metadata(x_api_key)
        if meta and meta.get("tenant_id"):
            return str(meta["tenant_id"])
        if any(
            settings.is_key_configured(k) and x_api_key == getattr(settings, k, None)
            for k in (
                "ARTSA_API_KEY",
                "ARTSA_ANALYST_API_KEY",
                "ARTSA_REDTEAM_API_KEY",
                "ARTSA_READONLY_API_KEY",
            )
        ):
            return x_tenant_id or settings.ARTSA_TENANT_ID or "default_org"
        if settings.ENVIRONMENT == "production" or settings.ARTSA_REQUIRE_AUTH:
            raise HTTPException(status_code=401, detail="invalid authenticated tenant")
    # Header-selected tenants are retained only for unauthenticated local
    # development. Never collapse unauthenticated production traffic into a
    # shared configured tenant: that hides an authentication failure and can
    # expose a default tenant's data.
    if settings.ENVIRONMENT == "production" or settings.ARTSA_REQUIRE_AUTH:
        raise HTTPException(status_code=401, detail="authenticated tenant required")
    return x_tenant_id or settings.ARTSA_TENANT_ID or "default_org"


async def get_provider_tenant(
    authorization: str | None = Header(None, alias="Authorization"),
    x_api_key: str | None = Header(None, alias="X-API-Key"),
) -> str:
    """Credential-management tenant identity; never caller-selected."""
    if authorization and authorization.lower().startswith("bearer "):
        tenant_id = await _tenant_for_password_session(authorization)
        if tenant_id:
            return tenant_id
        raise HTTPException(status_code=401, detail="invalid authenticated tenant")
    if x_api_key:
        from src.services.partner_key_registry import resolve_metadata

        meta = resolve_metadata(x_api_key)
        if meta and meta.get("tenant_id"):
            return str(meta["tenant_id"])
        if any(
            settings.is_key_configured(k) and x_api_key == getattr(settings, k, None)
            for k in (
                "ARTSA_API_KEY",
                "ARTSA_ANALYST_API_KEY",
                "ARTSA_REDTEAM_API_KEY",
                "ARTSA_READONLY_API_KEY",
            )
        ):
            return settings.ARTSA_TENANT_ID or "default_org"
        raise HTTPException(status_code=401, detail="invalid authenticated tenant")
    if settings.ARTSA_REQUIRE_AUTH or settings.ENVIRONMENT == "production":
        raise HTTPException(status_code=401, detail="authenticated tenant required")
    return settings.ARTSA_TENANT_ID


async def rate_limit_dependency() -> None:
    return None
