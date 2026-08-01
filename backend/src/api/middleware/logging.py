"""Structlog JSON Request Logging Middleware."""

import time
import json
import logging
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("artsa.requests")


class StructlogLoggingMiddleware(BaseHTTPMiddleware):
    """Logs HTTP request details in structured format."""

    async def dispatch(self, request: Request, call_next):
        start_time = time.perf_counter()
        response = await call_next(request)
        process_time_ms = (time.perf_counter() - start_time) * 1000

        log_data = {
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "latency_ms": round(process_time_ms, 2),
            "client_ip": request.client.host if request.client else "unknown",
        }
        logger.info(json.dumps(log_data))
        return response
