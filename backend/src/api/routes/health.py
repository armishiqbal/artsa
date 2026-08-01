"""Health Check Endpoint."""

from fastapi import APIRouter

router = APIRouter(tags=["Health"])


@router.get("/health")
async def get_health():
    """Health check status endpoint."""
    return {"status": "ok", "version": "0.1.0"}
