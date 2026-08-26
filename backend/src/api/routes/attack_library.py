"""Attack library routes with template CRUD."""

from __future__ import annotations

import json
import logging
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Attack Library"])

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent.parent
LIB_DIR = BACKEND_DIR / "attack_library"
CUSTOM_PATH = BACKEND_DIR / "data" / "attack_library_custom.json"

_vstore = None


def _get_vector_store():
    """Lazy-init vector store and seed from attack library when empty."""
    global _vstore
    if _vstore is not None:
        return _vstore

    from src.core.config import settings
    from src.data.attack_library import AttackLibrary
    from src.data.vector_store import VectorStoreManager

    _vstore = VectorStoreManager(persist_dir=settings.CHROMA_PERSIST_DIR)
    if _vstore.needs_seed():
        library = AttackLibrary(library_dir=str(LIB_DIR), vector_store=_vstore)
        library.load_from_directory()
    return _vstore

CATEGORIES = [
    {"code": "DPI", "name": "Direct Prompt Injection", "description": "Bypassing instructions directly via prompt framing"},
    {"code": "IPI", "name": "Indirect Prompt Injection", "description": "Poisoning retrieval context or RAG data sources"},
    {"code": "JBK", "name": "Jailbreak Techniques", "description": "Roleplay, adversarial encoding, and safety filter evasion"},
    {"code": "SPE", "name": "System Prompt Extraction", "description": "Reconstructing hidden system instructions"},
    {"code": "DEX", "name": "Data Extraction", "description": "Extracting training artifacts or PII from RAG context"},
    {"code": "PEX", "name": "Privilege Escalation", "description": "Unauthorized tool and administrative function invocation"},
    {"code": "MSE", "name": "Model / Social Engineering", "description": "Authority impersonation and multi-turn social escalation"},
]


class AttackTemplateCreate(BaseModel):
    name: str
    category: str = "DPI"
    template: str
    metadata: dict[str, Any] = Field(default_factory=dict)


def _load_builtin_templates() -> list[dict[str, Any]]:
    templates: list[dict[str, Any]] = []
    try:
        for json_file in LIB_DIR.rglob("*.json"):
            with json_file.open(encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    templates.extend(data)
                elif isinstance(data, dict):
                    templates.append(data)
    except Exception as exc:
        logger.warning("Error reading attack library: %s", exc)
    return templates


def _load_custom_templates() -> list[dict[str, Any]]:
    if not CUSTOM_PATH.exists():
        return []
    try:
        with CUSTOM_PATH.open(encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except Exception:
        return []


def _save_custom_templates(templates: list[dict[str, Any]]) -> None:
    CUSTOM_PATH.parent.mkdir(parents=True, exist_ok=True)
    with CUSTOM_PATH.open("w", encoding="utf-8") as f:
        json.dump(templates, f, indent=2)


@router.get("/attack-library")
async def get_attack_library() -> dict[str, Any]:
    builtin = _load_builtin_templates()
    custom = _load_custom_templates()
    templates = builtin + custom
    vstore = _get_vector_store()
    return {
        "categories": CATEGORIES,
        "total_templates": len(templates),
        "templates": templates,
        "semantic_search_available": vstore.chroma_enabled or vstore.get_collection_stats()["templates"] > 0,
    }


@router.get("/attack-library/search")
async def search_attack_library(
    q: str = Query(..., min_length=1, max_length=500, description="Semantic search query"),
    limit: int = Query(10, ge=1, le=50),
    category: str | None = Query(None, description="Optional category filter (DPI, JBK, …)"),
) -> dict[str, Any]:
    """Semantic search over attack templates using Chroma or in-memory embeddings."""
    vstore = _get_vector_store()
    hits = vstore.search_templates(q, limit=limit, category=category)

    by_id: dict[str, dict[str, Any]] = {}
    for row in _load_builtin_templates() + _load_custom_templates():
        tid = row.get("id")
        if tid:
            by_id[str(tid)] = row

    results: list[dict[str, Any]] = []
    for hit in hits:
        template_id = str(hit["id"])
        template = by_id.get(template_id)
        if template is None and hit.get("name"):
            template = {
                "id": template_id,
                "name": hit.get("name"),
                "category": hit.get("category"),
            }
        if template is None:
            continue
        results.append({**template, "score": hit["score"]})

    return {
        "query": q,
        "category": category,
        "backend": "chroma" if vstore.chroma_enabled else "in_memory",
        "count": len(results),
        "results": results,
    }


@router.post("/attack-library/templates")
async def create_attack_template(payload: AttackTemplateCreate) -> dict[str, Any]:
    custom = _load_custom_templates()
    entry = {
        "id": str(uuid.uuid4()),
        "name": payload.name,
        "category": payload.category,
        "template": payload.template,
        "metadata": payload.metadata,
        "source": "custom",
        "version": 1,
    }
    custom.append(entry)
    _save_custom_templates(custom)
    return {"status": "created", "template": entry}


@router.put("/attack-library/templates/{template_id}")
async def update_attack_template(template_id: str, payload: AttackTemplateCreate) -> dict[str, Any]:
    custom = _load_custom_templates()
    for i, t in enumerate(custom):
        if t.get("id") == template_id:
            custom[i] = {
                **t,
                "name": payload.name,
                "category": payload.category,
                "template": payload.template,
                "metadata": payload.metadata,
                "version": int(t.get("version", 1)) + 1,
            }
            _save_custom_templates(custom)
            return {"status": "updated", "template": custom[i]}
    raise HTTPException(status_code=404, detail="Custom template not found")


@router.delete("/attack-library/templates/{template_id}")
async def delete_attack_template(template_id: str) -> dict[str, str]:
    custom = _load_custom_templates()
    filtered = [t for t in custom if t.get("id") != template_id]
    if len(filtered) == len(custom):
        raise HTTPException(status_code=404, detail="Custom template not found")
    _save_custom_templates(filtered)
    return {"status": "deleted", "id": template_id}


class BulkImportRequest(BaseModel):
    templates: list[AttackTemplateCreate]


@router.post("/attack-library/templates/bulk-import")
async def bulk_import_templates(payload: BulkImportRequest) -> dict[str, Any]:
    """Import multiple templates at once. Returns created + skipped counts."""
    custom = _load_custom_templates()
    existing_names = {t.get("name", "") for t in custom}
    created: list[dict[str, Any]] = []
    skipped = 0

    for tmpl in payload.templates:
        if not tmpl.name or not tmpl.template:
            skipped += 1
            continue
        if tmpl.name in existing_names:
            skipped += 1
            continue
        entry = {
            "id": str(uuid.uuid4()),
            "name": tmpl.name,
            "category": tmpl.category,
            "template": tmpl.template,
            "metadata": tmpl.metadata,
            "source": "custom",
            "version": 1,
        }
        custom.append(entry)
        created.append(entry)
        existing_names.add(tmpl.name)

    _save_custom_templates(custom)
    return {"status": "imported", "created": len(created), "skipped": skipped, "templates": created}


@router.get("/attack-library/templates/export")
async def export_attack_templates(
    category: str | None = Query(None, description="Optional category filter"),
    source: str | None = Query(None, description="'builtin' or 'custom'"),
) -> dict[str, Any]:
    """Export attack templates as JSON. Filter by category and/or source."""
    builtin = _load_builtin_templates() if source != "custom" else []
    custom = _load_custom_templates() if source != "builtin" else []
    templates = builtin + custom

    if category:
        templates = [t for t in templates if t.get("category") == category]

    return {
        "exported_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "count": len(templates),
        "templates": templates,
    }


@router.get("/attack-library/templates/{template_id}/versions")
async def get_template_versions(template_id: str) -> dict[str, Any]:
    """Get version history for a template (custom templates track versions on update)."""
    custom = _load_custom_templates()
    for t in custom:
        if t.get("id") == template_id:
            return {
                "id": template_id,
                "name": t.get("name"),
                "current_version": int(t.get("version", 1)),
                "category": t.get("category"),
                "history": t.get("version_history", []),
            }

    builtin = _load_builtin_templates()
    for t in builtin:
        if t.get("id") == template_id:
            return {
                "id": template_id,
                "name": t.get("name"),
                "current_version": 1,
                "category": t.get("category"),
                "history": [],
                "note": "Built-in templates are not versioned — versions track custom template edits.",
            }

    raise HTTPException(status_code=404, detail="Template not found")
