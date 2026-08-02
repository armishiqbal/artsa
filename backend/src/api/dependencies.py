"""FastAPI Dependency Injection Providers."""

from typing import AsyncGenerator, Optional

from fastapi import Header
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.data.redis_client import RedisStreamProtocol, get_redis_stream_client
from src.services.event_processor import EventProcessor
from src.services.session_tracker import SessionTracker

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


async def get_current_tenant(x_tenant_id: Optional[str] = Header(None, alias="X-Tenant-ID")) -> str:
    return x_tenant_id or settings.ARTSA_TENANT_ID or "default_org"


async def rate_limit_dependency() -> None:
    return None
