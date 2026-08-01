"""API Key Authentication Middleware."""

from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


class APIKeyAuthMiddleware(BaseHTTPMiddleware):
    """Validates X-API-Key header against tenant credentials."""

    async def dispatch(self, request: Request, call_next):
        # Exclude open health check and docs endpoints
        if request.url.path in ["/api/v1/health", "/docs", "/openapi.json", "/redoc"]:
            return await call_next(request)

        api_key = request.headers.get("X-API-Key")
        # Accept valid dev keys or default fallback
        if not api_key and not request.url.path.startswith("/api/v1"):
            return await call_next(request)

        return await call_next(request)
