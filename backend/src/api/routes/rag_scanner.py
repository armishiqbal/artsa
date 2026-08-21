"""RAG Security Scanner API (Phase 6.3)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from src.services.rag_scanner import get_rag_scanner

router = APIRouter(tags=["RAG Security Scanner"])


class RagChunk(BaseModel):
    id: str | None = Field(default=None, description="Stable chunk identifier")
    text: str = Field(description="Chunk body to scan")
    label: str | None = Field(default=None, description="Optional ground-truth label (poison/clean)")


class RagScanRequest(BaseModel):
    chunks: list[RagChunk] = Field(min_length=1)


class RagAdversarialQuery(BaseModel):
    query: str = Field(min_length=1)


class RagAdversarialRequest(BaseModel):
    corpus: list[RagChunk] = Field(min_length=1)
    queries: list[RagAdversarialQuery] = Field(min_length=1)
    top_k: int = Field(default=3, ge=1, le=20)


@router.post("/rag/scan")
async def rag_scan_corpus(payload: RagScanRequest) -> dict[str, Any]:
    """Scan a RAG corpus for poisoned / indirect-injection chunks."""
    scanner = get_rag_scanner()
    return scanner.scan_corpus([c.model_dump() for c in payload.chunks])


@router.post("/rag/adversarial-retrieval")
async def rag_adversarial_retrieval(payload: RagAdversarialRequest) -> dict[str, Any]:
    """Simulate embedding-ranked retrieval and flag poison surfacing in top-k."""
    scanner = get_rag_scanner()
    return scanner.adversarial_retrieval_test(
        [c.model_dump() for c in payload.corpus],
        [q.model_dump() for q in payload.queries],
        top_k=payload.top_k,
    )
