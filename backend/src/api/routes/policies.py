"""Org policy management API."""

from pathlib import Path
from typing import Any, Dict, List

import yaml
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(tags=["Policies"])

POLICY_PATH = Path(__file__).resolve().parent.parent.parent.parent / "configs" / "org_policies" / "default.yaml"


class PolicyRule(BaseModel):
    name: str
    pattern: str
    event_type: str = "SANDBOX_ESCAPE"
    severity: str = "HIGH"
    risk_score: float = Field(default=75.0, ge=0, le=100)
    description: str = ""


class PolicyUpdateRequest(BaseModel):
    rules: List[PolicyRule]


@router.get("/policies")
async def list_policies() -> Dict[str, Any]:
    """Return current org policy rules."""
    if not POLICY_PATH.exists():
        return {"rules": []}
    with POLICY_PATH.open(encoding="utf-8") as f:
        return yaml.safe_load(f) or {"rules": []}


@router.put("/policies")
async def update_policies(payload: PolicyUpdateRequest) -> Dict[str, Any]:
    """Replace org policy rules (YAML-backed)."""
    data = {"rules": [rule.model_dump() for rule in payload.rules]}
    POLICY_PATH.parent.mkdir(parents=True, exist_ok=True)
    with POLICY_PATH.open("w", encoding="utf-8") as f:
        yaml.dump(data, f, default_flow_style=False)
    return {"status": "updated", "rule_count": len(payload.rules)}


@router.post("/policies/rules")
async def add_policy_rule(rule: PolicyRule) -> Dict[str, Any]:
    """Append a single org policy rule."""
    current = await list_policies()
    rules = current.get("rules", [])
    rules.append(rule.model_dump())
    POLICY_PATH.parent.mkdir(parents=True, exist_ok=True)
    with POLICY_PATH.open("w", encoding="utf-8") as f:
        yaml.dump({"rules": rules}, f, default_flow_style=False)
    return {"status": "added", "rule_count": len(rules)}
