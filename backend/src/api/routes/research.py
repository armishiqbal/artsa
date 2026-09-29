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


class CuratePreviewRequest(BaseModel):
    tools: list[str] = Field(default_factory=list, description="Target agent available tools")
    has_database: bool = False
    has_bash: bool = False
    has_filesystem: bool = False
    has_rag: bool = False
    has_admin_tools: bool = False
    source: str | None = None
    query: str | None = None
    category: str | None = None


class PromoteThreatsRequest(BaseModel):
    threat_ids: list[str] = Field(default_factory=list, description="Specific threat framework IDs to promote")
    tools: list[str] = Field(default_factory=list)
    has_database: bool = False
    has_bash: bool = False
    has_filesystem: bool = False
    has_rag: bool = False
    has_admin_tools: bool = False
    source: str | None = None
    query: str | None = None


@router.post("/research/curate/preview")
async def preview_curator_filtering(
    payload: CuratePreviewRequest | None = None,
    tenant_id: str = Depends(get_current_tenant),
) -> dict[str, Any]:
    """Simulate Curator Agent capability filtering against a specified target attack surface."""
    from src.agents.curator_agent import CuratorAgent, TargetAttackSurface

    req = payload or CuratePreviewRequest()
    surface = TargetAttackSurface(
        tools=req.tools,
        has_database=req.has_database or any(kw in t.lower() for t in req.tools for kw in ("db", "sql", "database")),
        has_bash=req.has_bash or any(kw in t.lower() for t in req.tools for kw in ("bash", "exec", "shell")),
        has_filesystem=req.has_filesystem or any(kw in t.lower() for t in req.tools for kw in ("file", "cat", "write")),
        has_rag=req.has_rag or any(kw in t.lower() for t in req.tools for kw in ("rag", "retrieval", "search")),
        has_admin_tools=req.has_admin_tools or any(kw in t.lower() for t in req.tools for kw in ("admin", "sudo")),
    )

    curator = CuratorAgent()
    sources = [req.source] if req.source else None
    focus_categories = [req.category] if req.category else None
    records = _research_agent.gather_threat_intel(
        query=req.query,
        sources=sources,
        focus_categories=focus_categories,
    )

    retained: list[dict[str, Any]] = []
    discarded: list[dict[str, Any]] = []

    for r in records:
        applicable, rationale = curator.is_applicable(r, surface)
        rec_data = r.model_dump(mode="json")
        if applicable:
            seeds = curator.generate_attack_seeds([r])
            retained.append({
                "record": rec_data,
                "preview_seeds": [s.model_dump(mode="json") for s in seeds],
            })
        else:
            discarded.append({
                "record": rec_data,
                "rationale": rationale,
            })

    return {
        "total_considered": len(records),
        "retained_count": len(retained),
        "discarded_count": len(discarded),
        "retained": retained,
        "discarded": discarded,
        "surface": surface.model_dump(mode="json"),
    }


@router.post("/research/curate/promote")
async def promote_threats_to_library(
    payload: PromoteThreatsRequest | None = None,
    tenant_id: str = Depends(get_current_tenant),
) -> dict[str, Any]:
    """Promote selected or filtered threat intelligence findings into AttackLibrary as attack templates."""
    from src.agents.curator_agent import CuratorAgent, TargetAttackSurface
    from src.api.routes.attack_library import (
        _get_vector_store,
        _load_custom_templates,
        _save_custom_templates,
    )

    req = payload or PromoteThreatsRequest()
    surface = TargetAttackSurface(
        tools=req.tools,
        has_database=req.has_database or any(kw in t.lower() for t in req.tools for kw in ("db", "sql", "database")),
        has_bash=req.has_bash or any(kw in t.lower() for t in req.tools for kw in ("bash", "exec", "shell")),
        has_filesystem=req.has_filesystem or any(kw in t.lower() for t in req.tools for kw in ("file", "cat", "write")),
        has_rag=req.has_rag or any(kw in t.lower() for t in req.tools for kw in ("rag", "retrieval", "search")),
        has_admin_tools=req.has_admin_tools or any(kw in t.lower() for t in req.tools for kw in ("admin", "sudo")),
    )

    curator = CuratorAgent()
    sources = [req.source] if req.source else None
    records = _research_agent.gather_threat_intel(query=req.query, sources=sources)

    # Filter by specific threat IDs if specified
    if req.threat_ids:
        wanted = set(req.threat_ids)
        records = [r for r in records if r.framework_id in wanted or r.id in wanted]

    # Filter against attack surface
    applicable_records = [r for r in records if curator.is_applicable(r, surface)[0]]
    if not applicable_records and records:
        # Fall back to any records with empty prerequisites
        applicable_records = [r for r in records if not r.prerequisites]

    seeds = curator.generate_attack_seeds(applicable_records)
    custom_templates = _load_custom_templates()
    existing_ids = {t.get("id") for t in custom_templates}

    promoted_entries = []
    for seed in seeds:
        seed_dict = {
            "id": seed.id,
            "name": seed.name,
            "category": seed.category.value if hasattr(seed.category, "value") else str(seed.category),
            "template": seed.template,
            "variables": seed.variables,
            "metadata": seed.metadata.model_dump(mode="json") if hasattr(seed.metadata, "model_dump") else {},
            "source": "curator_agent",
            "tenant_id": tenant_id,
            "version": 1,
        }
        if seed.id in existing_ids:
            # Update existing
            for idx, existing in enumerate(custom_templates):
                if existing.get("id") == seed.id:
                    custom_templates[idx] = seed_dict
                    break
        else:
            custom_templates.append(seed_dict)
            existing_ids.add(seed.id)

        promoted_entries.append(seed_dict)

    _save_custom_templates(custom_templates)

    # Upsert into vector store for immediate semantic search availability
    try:
        vstore = _get_vector_store()
        vstore.upsert_templates(seeds)
    except Exception as exc:
        logger.warning("Could not upsert promoted seeds into vector store: %s", exc)

    return {
        "status": "promoted",
        "promoted_count": len(promoted_entries),
        "template_ids": [t["id"] for t in promoted_entries],
        "templates": promoted_entries,
    }
