"""Health Check Route."""

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(tags=["Health"])


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "0.3.0"
    engine: str = "ARTSA Containment Engine"


@router.get("/health", response_model=HealthResponse)
async def get_health():
    """Return platform health status."""
    return HealthResponse()
