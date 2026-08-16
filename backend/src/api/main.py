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
from src.api.middleware.response_envelope import ResponseEnvelopeMiddleware
from src.api.middleware.security_headers import SecurityHeadersMiddleware
from src.api.routes.agent_runtime import router as agent_runtime_router
from src.api.routes.agents import router as agents_router
from src.api.routes.alerts import router as alerts_router
from src.api.routes.attack_library import router as attack_library_router
from src.api.routes.benchmark import router as benchmark_router
from src.api.routes.campaigns import router as campaigns_router
from src.api.routes.config_status import router as config_status_router
from src.api.routes.enterprise import router as enterprise_router
from src.api.routes.forensics import router as forensics_router
from src.api.routes.health import router as health_router
from src.api.routes.ingest import router as ingest_router
from src.api.routes.integrations import router as integrations_router
from src.api.routes.metrics import router as metrics_router
from src.api.routes.observatory import router as observatory_router
from src.api.routes.playground import router as playground_router
from src.api.routes.policies import router as policies_router
from src.api.routes.prometheus import router as prometheus_router
from src.api.routes.providers import router as providers_router
from src.api.routes.proxy import router as proxy_router
from src.api.routes.risks import router as risks_router
from src.api.routes.sessions import router as sessions_router
from src.api.routes.settings import router as settings_router
from src.api.routes.topology import router as topology_router
from src.api.routes.websocket import router as ws_router
from src.core.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("artsa.main")

ROUTERS = [
    health_router,
    ingest_router,
    integrations_router,
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
    providers_router,
    enterprise_router,
    agent_runtime_router,
    settings_router,
    proxy_router,
    playground_router,
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

        # Load user-registered LLM providers (keys decrypted into memory).
        try:
            from src.services.provider_registry import provider_registry

            await provider_registry.refresh()
            logger.info("Provider registry loaded: %s", provider_registry.names())
        except Exception as exc:
            logger.warning("Provider registry load skipped: %s", exc)

        # Load custom outbound connectors + start the background dispatcher.
        try:
            import asyncio

            from src.services.custom_integration_dispatcher import (
                custom_integration_worker,
                drain_telemetry,
            )
            from src.services.custom_integration_registry import custom_integration_registry

            await custom_integration_registry.refresh()
            logger.info("Custom integration registry loaded: %s", custom_integration_registry.names())
            custom_integration_worker.start()
            app.state.custom_integration_drain_task = asyncio.create_task(drain_telemetry())
            logger.info("Custom integration dispatcher started")
        except Exception as exc:
            logger.warning("Custom integration dispatcher start skipped: %s", exc)

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

    # Shutdown: stop the telemetry drainer + custom integration worker pool.
    if not settings.is_testing:
        import asyncio

        drain_task = getattr(app.state, "custom_integration_drain_task", None)
        if drain_task is not None:
            drain_task.cancel()
            try:
                with asyncio.timeout(2):
                    await drain_task
            except (asyncio.CancelledError, TimeoutError):
                pass
        try:
            from src.services.custom_integration_dispatcher import custom_integration_worker

            custom_integration_worker.stop(wait=True)
            logger.info("Custom integration dispatcher stopped")
        except Exception as exc:  # pragma: no cover
            logger.warning("Custom integration dispatcher stop skipped: %s", exc)


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
    # Opt-in response envelope — see src/core/config.py ARTSA_RESPONSE_ENVELOPE.
    if settings.ARTSA_RESPONSE_ENVELOPE:
        app.add_middleware(ResponseEnvelopeMiddleware)

    for prefix in ("/v1", "/api/v1"):
        for router in ROUTERS:
            app.include_router(router, prefix=prefix)

    # Root-level liveness/readiness probes (documented at `/health` in the README
    # and used by external monitors). The health router is also mounted under
    # /v1 and /api/v1; this makes the bare `/health` and `/ready` paths work.
    app.include_router(health_router)

    return app


app = create_app()
