"""Threat Intelligence Research Routes."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from src.agents.research_agent import ResearchAgent, ThreatIntelligenceRecord
from src.api.dependencies import get_current_tenant
from src.models import AttackCategory

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Research"])

# Shared singleton ResearchAgent for intelligence retrieval & caching
_research_agent = ResearchAgent()


class SyncThreatsRequest(BaseModel):
    query: str = Field(default="LLM agent", description="Query keyword for live NVD search")
    limit: int = Field(default=10, ge=1, le=50, description="Max live records to fetch")


class SyncThreatsResponse(BaseModel):
    status: str
    nvd_count: int
    mitre_atlas_count: int
    total_ingested: int


@router.get("/research/threats")
async def list_threat_intelligence(
    query: str | None = Query(default=None, description="Search keyword"),
    source: str | None = Query(default=None, description="Filter source: NIST_AI_RMF, OWASP_ASI, MITRE_ATLAS, VULNERABILITY_DISCLOSURE, NVD_LIVE"),
    category: str | None = Query(default=None, description="Filter attack category code or value"),
    include_live_feeds: bool = Query(default=False, description="Trigger live feed sync before gathering"),
    tenant_id: str = Depends(get_current_tenant),
) -> dict[str, Any]:
    """Retrieve structured threat intelligence records across all supported frameworks."""
    sources = [source] if source else None
    focus_categories = [category] if category else None

    records = _research_agent.gather_threat_intel(
        query=query,
        sources=sources,
        focus_categories=focus_categories,
        include_live_feeds=include_live_feeds,
    )

    return {
        "count": len(records),
        "threats": [r.model_dump(mode="json") for r in records],
    }


@router.post("/research/sync", response_model=SyncThreatsResponse)
async def sync_threat_intelligence(
    payload: SyncThreatsRequest | None = None,
    tenant_id: str = Depends(get_current_tenant),
) -> SyncThreatsResponse:
    """Sync live external vulnerability and threat intelligence feeds (NVD + MITRE ATLAS)."""
    q = payload.query if payload else "LLM agent"
    limit = payload.limit if payload else 10

    result = _research_agent.sync_live_feeds(nvd_query=q, limit=limit)
    return SyncThreatsResponse.model_validate(result)


@router.get("/research/frameworks")
async def get_framework_metrics(
    tenant_id: str = Depends(get_current_tenant),
) -> dict[str, Any]:
    """Return threat finding count aggregations grouped by intelligence source."""
    all_threats = _research_agent.gather_threat_intel()
    by_source: dict[str, int] = {}
    by_category: dict[str, int] = {}

    for t in all_threats:
        by_source[t.source] = by_source.get(t.source, 0) + 1
        cat_key = t.category.value if hasattr(t.category, "value") else str(t.category)
        by_category[cat_key] = by_category.get(cat_key, 0) + 1

    return {
        "total_threats": len(all_threats),
        "sources": by_source,
        "categories": by_category,
    }
