"""Distributed rate limiting via Redis with in-memory fallback."""

from __future__ import annotations

import logging
import time

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from src.core.config import settings

logger = logging.getLogger(__name__)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Per-tenant rate limit using Redis when available, else in-process token bucket."""

    def __init__(self, app, requests_per_minute: int = 10000) -> None:
        super().__init__(app)
        self.rate_limit = requests_per_minute
        self._tokens: dict[str, float] = {}
        self._last_update: dict[str, float] = {}

    def _tenant_key(self, request: Request) -> str:
        return (
            request.headers.get("X-Tenant-ID")
            or request.headers.get("X-API-Key", "")[:16]
            or "default_tenant"
        )

    def _check_redis(self, tenant_id: str) -> bool | None:
        """Return True if allowed, False if denied, None if Redis unavailable."""
        if settings.is_testing or not settings.USE_REDIS_RATE_LIMIT:
            return None

        try:
            from src.data.redis_client import redis_is_live

            if not redis_is_live():
                return None

            import redis

            client = redis.from_url(settings.REDIS_URL, decode_responses=True)
            window = int(time.time() // 60)
            key = f"artsa:rate:{tenant_id}:{window}"
            count = client.incr(key)
            if count == 1:
                client.expire(key, 60)
            return count <= self.rate_limit
        except Exception as exc:
            logger.debug("Redis rate limit unavailable: %s", exc)
            return None

    def _check_memory(self, tenant_id: str) -> bool:
        now = time.time()
        fill_rate = self.rate_limit / 60.0
        last = self._last_update.get(tenant_id, now)
        elapsed = now - last
        current_tokens = min(
            self.rate_limit,
            self._tokens.get(tenant_id, self.rate_limit) + elapsed * fill_rate,
        )
        self._last_update[tenant_id] = now
        if current_tokens >= 1.0:
            self._tokens[tenant_id] = current_tokens - 1.0
            return True
        return False

    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS" or request.url.path.endswith("/health"):
            return await call_next(request)

        tenant_id = self._tenant_key(request)
        redis_result = self._check_redis(tenant_id)

        if redis_result is False:
            return JSONResponse(
                status_code=429,
                content={
                    "detail": f"Rate limit exceeded ({self.rate_limit} requests/minute per tenant)"
                },
                headers={"Retry-After": "60"},
            )
        if redis_result is None and not self._check_memory(tenant_id):
            return JSONResponse(
                status_code=429,
                content={
                    "detail": f"Rate limit exceeded ({self.rate_limit} requests/minute per tenant)"
                },
                headers={"Retry-After": "60"},
            )

        return await call_next(request)
