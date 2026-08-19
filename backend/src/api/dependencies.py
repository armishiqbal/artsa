"""FastAPI Dependency Injection Providers."""

import logging
from collections.abc import AsyncGenerator

from fastapi import Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.data.db import get_async_session
from src.data.redis_client import RedisStreamProtocol, get_redis_stream_client
from src.services.event_processor import EventProcessor
from src.services.session_tracker import SessionTracker

logger = logging.getLogger(__name__)

_processor = EventProcessor()
_tracker = SessionTracker()


class MockAsyncSession:
    """Mock AsyncSession for test environments."""

    def add(self, instance: object) -> None:
        pass

    async def commit(self) -> None:
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

    from src.data.db import get_async_session

    async for session in get_async_session():
        yield session


def get_redis() -> RedisStreamProtocol:
    return get_redis_stream_client()


def get_event_processor() -> EventProcessor:
    return _processor


def get_session_tracker() -> SessionTracker:
    return _tracker


async def get_current_tenant(
    x_tenant_id: str | None = Header(None, alias="X-Tenant-ID"),
    authorization: str | None = Header(None, alias="Authorization"),
    db: AsyncSession = Depends(get_async_session),
) -> str:
    """Resolve the effective tenant for the request.

    Hardening (WS-3.1): a password-session bearer token is authoritative — the
    user's home tenant comes from the account record, never from a caller-chosen
    header. Static API keys and anonymous requests fall back to the header /
    configured default.
    """
    if authorization and authorization.lower().startswith("bearer "):
        try:
            from src.core.password_auth import decode_session_token
            from src.data.user_store import get_user_by_id as _get_user_by_id

            claims = decode_session_token(authorization[7:].strip())
            if claims and claims.get("sub"):
                user = await _get_user_by_id(db, str(claims["sub"]))
                if user is not None and user.tenant_id:
                    return user.tenant_id
        except Exception:  # pragma: no cover - token/user lookup must never break routing
            logger.debug("Tenant resolution from session failed; falling back to header")
    return x_tenant_id or settings.ARTSA_TENANT_ID or "default_org"


async def rate_limit_dependency() -> None:
    return None
