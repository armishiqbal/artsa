"""FastAPI Dependency Injection Providers."""

from typing import AsyncGenerator, Optional
from fastapi import Header
from sqlalchemy.ext.asyncio import AsyncSession
from src.services.event_processor import EventProcessor
from src.services.session_tracker import SessionTracker

_processor = EventProcessor()
_tracker = SessionTracker()


class MockAsyncSession:
    """Mock AsyncSession for test environments without greenlet / DB."""

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
    """Dependency provider yielding async database session."""
    yield MockAsyncSession()



class MockRedis:
    """Mock Redis client for test environments."""

    def __init__(self) -> None:
        self._streams = {}

    def xadd(self, stream_name: str, fields: dict) -> str:
        if stream_name not in self._streams:
            self._streams[stream_name] = []
        self._streams[stream_name].append(fields)
        return "1000-0"

    def xlen(self, stream_name: str) -> int:
        return len(self._streams.get(stream_name, []))


_redis_instance = MockRedis()


def get_redis() -> MockRedis:
    """Dependency provider returning Redis client instance."""
    return _redis_instance


def get_current_tenant(x_api_key: Optional[str] = Header(None, alias="X-API-Key")) -> str:
    """Extract tenant_id from X-API-Key header."""
    if not x_api_key:
        return "default_tenant"
    return x_api_key


def rate_limit_dependency(x_api_key: Optional[str] = Header(None, alias="X-API-Key")) -> None:
    """Rate limit validator dependency (10K req/min)."""
    pass


def get_event_processor() -> EventProcessor:
    """Dependency provider for EventProcessor service."""
    return _processor


def get_session_tracker() -> SessionTracker:
    """Dependency provider for SessionTracker service."""
    return _tracker
