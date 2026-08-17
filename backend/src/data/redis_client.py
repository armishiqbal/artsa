"""Redis stream client with real Redis and in-memory fallback."""

from __future__ import annotations

import logging
from typing import Any, Protocol

from src.core.config import settings

logger = logging.getLogger(__name__)


class RedisStreamProtocol(Protocol):
    def xadd(self, stream: str, fields: dict[str, Any]) -> str: ...
    def xadd_many(self, stream: str, entries: list[dict[str, Any]]) -> list[str]: ...
    def ping(self) -> bool: ...


class InMemoryRedis:
    """In-memory Redis stream substitute when Redis is unavailable."""

    def __init__(self) -> None:
        self._streams: dict[str, list[dict[str, Any]]] = {}

    def xadd(self, stream: str, fields: dict[str, Any]) -> str:
        self._streams.setdefault(stream, []).append(fields)
        return str(len(self._streams[stream]))

    def xadd_many(self, stream: str, entries: list[dict[str, Any]]) -> list[str]:
        """Append multiple entries in one call (batched ingest hot path)."""
        if not entries:
            return []
        existing = self._streams.setdefault(stream, [])
        existing.extend(entries)
        start = len(existing) - len(entries)
        return [str(start + i + 1) for i in range(len(entries))]

    def ping(self) -> bool:
        return True

    @property
    def is_live(self) -> bool:
        return False


class LiveRedisClient:
    """redis-py wrapper for stream publish."""

    def __init__(self, url: str) -> None:
        import redis

        self._client = redis.from_url(url, decode_responses=True)
        self._client.ping()

    def xadd(self, stream: str, fields: dict[str, Any]) -> str:
        return self._client.xadd(stream, fields)  # type: ignore[return-value]

    def xadd_many(self, stream: str, entries: list[dict[str, Any]]) -> list[str]:
        """Batch multiple stream writes through one Redis pipeline round-trip."""
        if not entries:
            return []
        pipe = self._client.pipeline()  # type: ignore[attr-defined]
        for fields in entries:
            pipe.xadd(stream, fields)
        return [str(x) for x in pipe.execute()]

    def ping(self) -> bool:
        return bool(self._client.ping())

    @property
    def is_live(self) -> bool:
        return True


_client: RedisStreamProtocol | None = None
_using_live = False


def get_redis_stream_client() -> RedisStreamProtocol:
    """Return shared Redis client (live or in-memory fallback)."""
    global _client, _using_live
    if _client is not None:
        return _client

    if settings.is_testing or settings.REDIS_URL.lower() in ("memory", "none", ""):
        _client = InMemoryRedis()
        _using_live = False
        return _client

    try:
        _client = LiveRedisClient(settings.REDIS_URL)
        _using_live = True
        logger.info("Connected to Redis at %s", settings.REDIS_URL.split("@")[-1])
    except Exception as exc:
        logger.warning("Redis unavailable (%s), using in-memory fallback", exc)
        _client = InMemoryRedis()
        _using_live = False
    return _client


def redis_is_live() -> bool:
    get_redis_stream_client()
    return _using_live


def reset_redis_client() -> None:
    """Reset singleton (tests)."""
    global _client, _using_live
    _client = None
    _using_live = False


# Backward-compatible aliases
RedisClient = InMemoryRedis


def get_redis_client() -> RedisStreamProtocol:
    return get_redis_stream_client()
