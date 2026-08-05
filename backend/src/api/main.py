"""FastAPI Application Factory with complete middleware and router configurations."""

import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Load .env from repo root before settings initialization
_REPO_ROOT = BACKEND_DIR.parent
load_dotenv(_REPO_ROOT / ".env", override=False)
load_dotenv(BACKEND_DIR / ".env", override=False)

from src.api.middleware.auth import APIKeyAuthMiddleware
from src.api.middleware.logging import StructlogLoggingMiddleware
from src.api.middleware.rate_limit import RateLimitMiddleware
from src.api.middleware.rbac_middleware import RBACMiddleware
from src.api.middleware.security_headers import SecurityHeadersMiddleware
from src.api.routes.agents import router as agents_router
from src.api.routes.agent_runtime import router as agent_runtime_router
from src.api.routes.alerts import router as alerts_router
from src.api.routes.attack_library import router as attack_library_router
from src.api.routes.benchmark import router as benchmark_router
from src.api.routes.campaigns import router as campaigns_router
from src.api.routes.config_status import router as config_status_router
from src.api.routes.enterprise import router as enterprise_router
from src.api.routes.forensics import router as forensics_router
from src.api.routes.health import router as health_router
from src.api.routes.ingest import router as ingest_router
from src.api.routes.metrics import router as metrics_router
from src.api.routes.observatory import router as observatory_router
from src.api.routes.policies import router as policies_router
from src.api.routes.prometheus import router as prometheus_router
from src.api.routes.risks import router as risks_router
from src.api.routes.sessions import router as sessions_router
from src.api.routes.topology import router as topology_router
from src.api.routes.websocket import router as ws_router
from src.core.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("artsa.main")

ROUTERS = [
    health_router,
    ingest_router,
    sessions_router,
    agents_router,
    alerts_router,
    ws_router,
    metrics_router,
    observatory_router,
    topology_router,
    policies_router,
    benchmark_router,
    campaigns_router,
    attack_library_router,
    forensics_router,
    risks_router,
    config_status_router,
    prometheus_router,
    enterprise_router,
    agent_runtime_router,
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not settings.is_testing:
        try:
            from src.data.db import init_db
            await init_db()
            logger.info("Database initialized (%s)", settings.DATABASE_URL.split(":///")[-1])
        except Exception as exc:
            logger.warning("Database init skipped: %s", exc)

        # Load persisted alerts + webhook rules so the inbox survives restarts.
        try:
            from src.data.db import get_async_session
            from src.services.alert_store import load_persisted_state

            async with get_async_session() as session:
                await load_persisted_state(session)
            logger.info("Persisted alerts and webhook rules loaded")
        except Exception as exc:
            logger.warning("Alert state load skipped: %s", exc)

        if settings.WARM_BENCHMARK_ON_START:
            import asyncio

            from src.services.startup_warmup import warm_benchmark_caches_async

            asyncio.create_task(warm_benchmark_caches_async())
            logger.info("Benchmark cache warm scheduled on startup")

        if settings.SCHEDULED_ABLATION_INTERVAL_SEC > 0:
            import asyncio

            from src.services.scheduled_ablation import start_scheduled_ablation

            asyncio.create_task(start_scheduled_ablation())
            logger.info("Scheduled ablation task registered")

    yield


def create_app() -> FastAPI:
    """FastAPI application factory."""
    app = FastAPI(
        title="ARTSA — AI Agent Containment Engine",
        version="0.3.0",
        description="Real-time AI agent containment, escape detection, and red-team wargame API",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        # allow_credentials is not permitted alongside a wildcard origin list.
        allow_credentials="*" not in settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RateLimitMiddleware, requests_per_minute=settings.ARTSA_RATE_LIMIT_RPM)
    app.add_middleware(RBACMiddleware)
    app.add_middleware(APIKeyAuthMiddleware)
    app.add_middleware(StructlogLoggingMiddleware)

    for prefix in ("/v1", "/api/v1"):
        for router in ROUTERS:
            app.include_router(router, prefix=prefix)

    return app


app = create_app()
