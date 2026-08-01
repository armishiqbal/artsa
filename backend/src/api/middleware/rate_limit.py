"""Token Bucket Rate Limiting Middleware (10K req/min per tenant)."""

import time
from typing import Dict
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Token bucket per tenant_id enforcing 10K req/min rate limits."""

    def __init__(self, app, requests_per_minute: int = 10000) -> None:
        super().__init__(app)
        self.rate_limit = requests_per_minute
        self._tokens: Dict[str, float] = {}
        self._last_update: Dict[str, float] = {}

    async def dispatch(self, request: Request, call_next):
        tenant_id = request.headers.get("X-API-Key", "default_tenant")
        now = time.time()

        # Refill tokens (10000 tokens / 60s)
        fill_rate = self.rate_limit / 60.0
        last = self._last_update.get(tenant_id, now)
        elapsed = now - last
        
        current_tokens = min(self.rate_limit, self._tokens.get(tenant_id, self.rate_limit) + elapsed * fill_rate)
        self._last_update[tenant_id] = now

        if current_tokens >= 1.0:
            self._tokens[tenant_id] = current_tokens - 1.0
            return await call_next(request)
        else:
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded (10,000 requests/minute per tenant)"}
            )
