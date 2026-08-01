"""FastAPI Main Application Factory with CORS, Structured Logging, and API Routers."""

import sys
import time
import logging
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Add backend directory to sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from src.api.routes.health import router as health_router
from src.api.routes.ingest import router as ingest_router
from src.api.routes.sessions import router as sessions_router
from src.api.routes.agents import router as agents_router
from src.api.routes.alerts import router as alerts_router
from src.api.routes.websocket import router as ws_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("artsa.api")


def create_app() -> FastAPI:
    """FastAPI application factory."""
    app = FastAPI(
        title="ARTSA — AI Agent Containment & Escape Detection Platform",
        version="0.3.0",
        description="Real-Time AI Agent Containment Platform (Datadog for AI Escape Detection)",
    )

    # Enable CORS for Next.js Dashboard
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Structured Request Logging Middleware
    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        start_time = time.perf_counter()
        response = await call_next(request)
        process_time = (time.perf_counter() - start_time) * 1000
        logger.info(
            "%s %s -> Status %d (%.2f ms)",
            request.method,
            request.url.path,
            response.status_code,
            process_time,
        )
        return response

    # Include API Routers
    app.include_router(health_router, prefix="/api/v1")
    app.include_router(ingest_router, prefix="/api/v1")
    app.include_router(sessions_router, prefix="/api/v1")
    app.include_router(agents_router, prefix="/api/v1")
    app.include_router(alerts_router, prefix="/api/v1")
    app.include_router(ws_router, prefix="/api/v1")

    return app


app = create_app()
