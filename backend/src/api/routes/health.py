"""Health Check Endpoint."""

from fastapi import APIRouter

from src.core.config import settings
from src.data.redis_client import redis_is_live

router = APIRouter(tags=["Health"])


@router.get("/health")
async def get_health():
    """Health check with subsystem status."""
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
            ],
        },
    }
