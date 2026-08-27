"""API Response Envelope Middleware — standardizes all JSON responses.

Wraps successful responses in:
    {
      "success": true,
      "data": <original response>,
      "meta": {
        "timestamp": "<ISO8601>",
        "version": "0.3.0",
        "request_id": "<uuid>"
      }
    }

Error responses (HTTP 4xx/5xx) are wrapped as:
    {
      "success": false,
      "error": {
        "code": "<status_code>",
        "message": "<detail>",
        "type": "<error_type>"
      },
      "meta": { ... }
    }

Exclusions: health/ready endpoints and WebSocket upgrades bypass wrapping
to avoid breaking probes and protocol handshakes.
"""

from __future__ import annotations

import json
import time
import uuid
from datetime import UTC, datetime

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.types import ASGIApp

EXCLUDED_PATHS: frozenset[str] = frozenset({
    "/api/v1/health",
    "/v1/health",
    "/api/v1/ready",
    "/v1/ready",
    "/api/v1/metrics/prometheus",
    "/v1/metrics/prometheus",
    # Harness Custom Security Service reads top-level allowed/blocked; keep flat.
    "/api/v1/ingest",
    "/v1/ingest",
    "/api/v1/inspect",
    "/v1/inspect",
    "/api/v1/websocket",
    "/v1/websocket",
    "/docs",
    "/openapi.json",
    "/redoc",
})

# Path prefixes that should NOT be wrapped (proxy passthrough, MCP, etc.)
EXCLUDED_PREFIXES: tuple[str, ...] = (
    "/v1/proxy",
    "/api/v1/proxy",
    "/v1/mcp",
    "/api/v1/mcp",
)

API_VERSION = "0.3.0"


def _build_meta(request_id: str) -> dict[str, str]:
    return {
        "timestamp": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        "version": API_VERSION,
        "request_id": request_id,
    }


class ResponseEnvelopeMiddleware(BaseHTTPMiddleware):
    """Wraps all JSON API responses in a standardised envelope."""

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        path = request.url.path.rstrip("/")

        # Skip wrapping for excluded paths and prefixes
        if path in EXCLUDED_PATHS or path.startswith(("/docs", "/openapi") + EXCLUDED_PREFIXES):
            return await call_next(request)

        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        start = time.perf_counter()

        response = await call_next(request)

        # Only wrap JSON responses
        content_type = response.headers.get("content-type", "")
        if "application/json" not in content_type:
            return response

        elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
        meta = _build_meta(request_id)
        meta["latency_ms"] = str(elapsed_ms)

        # Read original body
        body = b""
        async for chunk in response.__dict__.get("body_iterator", []):
            body += chunk
        if not body:
            # Reconstruct body iterator for empty responses
            pass

        try:
            original = json.loads(body) if body else {}
        except (json.JSONDecodeError, TypeError):
            original = {}

        if 200 <= response.status_code < 400:
            envelope = {"success": True, "data": original, "meta": meta}
        else:
            # Error path: extract detail from common FastAPI error shapes
            error_detail = original
            if isinstance(original, dict) and "detail" in original:
                error_detail = original["detail"]
            envelope = {
                "success": False,
                "error": {
                    "code": response.status_code,
                    "message": str(error_detail) if not isinstance(error_detail, dict) else error_detail.get("message", str(error_detail)),
                    "type": _error_type_for_status(response.status_code),
                },
                "meta": meta,
            }

        wrapped_body = json.dumps(envelope, default=str).encode("utf-8")
        headers = dict(response.headers)
        headers["content-length"] = str(len(wrapped_body))
        headers["x-request-id"] = request_id
        headers["x-response-time-ms"] = str(elapsed_ms)

        return Response(
            content=wrapped_body,
            status_code=response.status_code,
            headers=headers,
            media_type="application/json",
        )


def _error_type_for_status(status_code: int) -> str:
    if status_code == 400:
        return "VALIDATION_ERROR"
    if status_code == 401:
        return "AUTHENTICATION_ERROR"
    if status_code == 403:
        return "AUTHORIZATION_ERROR"
    if status_code == 404:
        return "NOT_FOUND"
    if status_code == 409:
        return "CONFLICT"
    if status_code == 422:
        return "UNPROCESSABLE_ENTITY"
    if status_code == 429:
        return "RATE_LIMIT_EXCEEDED"
    if 500 <= status_code < 600:
        return "INTERNAL_ERROR"
    return "UNKNOWN_ERROR"
