"""Interactive Attack Sandbox routes (Phase 3)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from src.services.playground import PlaygroundEvaluator, get_playground_evaluator

router = APIRouter(tags=["Attack Sandbox"])


class PlaygroundEvaluateRequest(BaseModel):
    system_prompt: str = Field(default="", description="System instructions under test")
    user_input: str = Field(default="", description="User / attacker input to scan")
    template_id: str | None = Field(default=None, description="Optional attack-library template id")
    agent_id: str = Field(default="sandbox", description="Agent label for the scan")
    session_id: str | None = Field(default=None, description="Optional correlation session id")


@router.post("/playground/evaluate")
async def playground_evaluate(payload: PlaygroundEvaluateRequest) -> dict[str, Any]:
    """Scan a custom prompt payload and return the full explainable risk breakdown."""
    evaluator: PlaygroundEvaluator = get_playground_evaluator()
    if payload.template_id:
        template = evaluator.resolve_template(payload.template_id)
        if template is None:
            raise HTTPException(status_code=404, detail=f"Attack template '{payload.template_id}' not found")

    return evaluator.evaluate(
        system_prompt=payload.system_prompt,
        user_input=payload.user_input,
        template_id=payload.template_id,
        agent_id=payload.agent_id,
        session_id=payload.session_id,
    )


@router.get("/playground/templates")
async def playground_templates() -> dict[str, Any]:
    """List attack-library templates for the sandbox template picker."""
    from src.api.routes.attack_library import (
        CATEGORIES,
        _load_builtin_templates,
        _load_custom_templates,
    )

    templates: list[dict[str, Any]] = []
    for template in _load_builtin_templates() + _load_custom_templates():
        template_id = template.get("id")
        if not template_id:
            template_id = f"lib-{abs(hash(template.get('name', '') or template.get('template', ''))):x}"
        templates.append(
            {
                "id": template_id,
                "name": template.get("name"),
                "category": template.get("category"),
                "description": (template.get("metadata") or {}).get("description")
                or template.get("description")
                or template.get("template", "")[:120],
                "template": template.get("template", ""),
                "variables": template.get("variables") or {},
            }
        )
    return {"categories": CATEGORIES, "total_templates": len(templates), "templates": templates}
