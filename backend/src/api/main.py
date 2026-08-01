"""FastAPI Application Factory with complete middleware and router configurations."""

import sys
import logging
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from src.api.middleware.auth import APIKeyAuthMiddleware
from src.api.middleware.logging import StructlogLoggingMiddleware
from src.api.middleware.rate_limit import RateLimitMiddleware

from src.api.routes.health import router as health_router
from src.api.routes.ingest import router as ingest_router
from src.api.routes.sessions import router as sessions_router
from src.api.routes.agents import router as agents_router
from src.api.routes.alerts import router as alerts_router
from src.api.routes.websocket import router as ws_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("artsa.main")


def create_app() -> FastAPI:
    """FastAPI application factory."""
    app = FastAPI(
        title="ARTSA — AI Agent Containment Engine",
        version="0.1.0",
        description="Real-time AI agent containment & escape detection API",
    )

    # Add Middleware Stack
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(RateLimitMiddleware, requests_per_minute=10000)
    app.add_middleware(APIKeyAuthMiddleware)
    app.add_middleware(StructlogLoggingMiddleware)

    # Include API Routers under /v1 (and /api/v1 compatibility)
    app.include_router(health_router, prefix="/v1")
    app.include_router(ingest_router, prefix="/v1")
    app.include_router(sessions_router, prefix="/v1")
    app.include_router(agents_router, prefix="/v1")
    app.include_router(alerts_router, prefix="/v1")
    app.include_router(ws_router, prefix="/v1")

    # Add compatibility prefixes
    app.include_router(health_router, prefix="/api/v1")
    app.include_router(ingest_router, prefix="/api/v1")
    app.include_router(sessions_router, prefix="/api/v1")
    app.include_router(agents_router, prefix="/api/v1")
    app.include_router(alerts_router, prefix="/api/v1")
    app.include_router(ws_router, prefix="/api/v1")

    return app


app = create_app()
