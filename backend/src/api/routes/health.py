"""Health and readiness endpoints."""

from fastapi import APIRouter, Response, status

from src.core.auth_credentials import any_static_api_key_configured
from src.core.config import settings
from src.data.redis_client import redis_is_live

router = APIRouter(tags=["Health"])


@router.get("/health")
async def get_health():
    """Liveness probe — process is up (does not fail on soft dependency issues)."""
    db_status = "ok"
    if not settings.is_testing:
        try:
            from src.data.db import get_engine

            get_engine()
        except Exception as exc:
            db_status = f"error: {exc}"

    rag_backend = "in_memory"
    if settings.USE_PINECONE_RAG and settings.is_key_configured("PINECONE_API_KEY"):
        rag_backend = "pinecone"
    elif settings.USE_CHROMA_RAG:
        rag_backend = "chroma"

    return {
        "status": "ok",
        "version": "0.3.0",
        "environment": settings.ENVIRONMENT,
        "subsystems": {
            "database": db_status,
            "redis": "live" if redis_is_live() else "fallback",
            "use_sqlite": settings.USE_SQLITE,
            "auth_required": settings.auth_required,
            "oidc_enabled": settings.ARTSA_OIDC_ENABLED,
            "auto_enforce": settings.ARTSA_AUTO_ENFORCE,
            "block_contained_sessions": settings.ARTSA_BLOCK_CONTAINED_SESSIONS,
            "rag_backend": rag_backend,
            "prometheus": "/api/v1/metrics/prometheus",
        },
        "api_gateway": {
            "status": "fully_connected",
            "mode": "unified",
            "standalone_required": False,
            "routes": [
                "ingest",
                "campaigns",
                "attack-library",
                "observatory",
                "topology",
                "sessions",
                "metrics",
                "mcp",
                "otel",
                "risks",
            ],
        },
    }


@router.get("/ready")
async def get_ready(response: Response):
    """Readiness probe — refuse traffic when production config is unsafe."""
    checks: dict[str, str] = {}
    ready = True

    # Database engine must construct
    try:
        if not settings.is_testing:
            from src.data.db import get_engine

            get_engine()
        checks["database"] = "ok"
    except Exception as exc:
        checks["database"] = f"error: {exc}"
        ready = False

    if settings.auth_required:
        if any_static_api_key_configured() or settings.ARTSA_OIDC_ENABLED:
            checks["auth"] = "ok"
        else:
            checks["auth"] = "missing_credentials"
            ready = False
    else:
        checks["auth"] = "optional"

    if settings.ENVIRONMENT == "production" and (settings.ARTSA_CORS_ORIGINS or "*").strip() == "*":
        checks["cors"] = "wildcard_forbidden"
        ready = False
    else:
        checks["cors"] = "ok"

    checks["redis"] = "live" if redis_is_live() else "fallback"
    checks["auto_enforce"] = "on" if settings.ARTSA_AUTO_ENFORCE else "off"

    if not ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return {
        "status": "ready" if ready else "not_ready",
        "environment": settings.ENVIRONMENT,
        "checks": checks,
    }
