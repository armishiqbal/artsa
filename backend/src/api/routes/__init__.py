"""API Routes Package."""

from src.api.routes.agents import router as agents_router
from src.api.routes.alerts import router as alerts_router
from src.api.routes.health import router as health_router
from src.api.routes.ingest import router as ingest_router
from src.api.routes.sessions import router as sessions_router
from src.api.routes.websocket import router as ws_router

__all__ = [
    "agents_router",
    "alerts_router",
    "health_router",
    "ingest_router",
    "sessions_router",
    "ws_router",
]
