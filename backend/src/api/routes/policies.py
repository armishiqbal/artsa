"""Org policy management API."""

import re
from pathlib import Path
from typing import Any

import yaml
from fastapi import APIRouter
from pydantic import BaseModel, Field

from src.data.policy_version_store import current_version, diff_versions, list_versions, snapshot_rules

router = APIRouter(tags=["Policies"])

POLICY_PATH = Path(__file__).resolve().parent.parent.parent.parent / "configs" / "org_policies" / "default.yaml"


def _write_rules(rules: list[dict[str, Any]], *, trigger: str, note: str | None = None) -> dict[str, Any]:
    POLICY_PATH.parent.mkdir(parents=True, exist_ok=True)
    with POLICY_PATH.open("w", encoding="utf-8") as f:
        yaml.dump({"rules": rules}, f, default_flow_style=False)
    if current_version() == 0 and rules:
        return snapshot_rules(rules, trigger="initial", note=note or "Initial playbook snapshot")
    return snapshot_rules(rules, trigger=trigger, note=note)


class PolicyRule(BaseModel):
    name: str
    pattern: str
    event_type: str = "SANDBOX_ESCAPE"
    severity: str = "HIGH"
    risk_score: float = Field(default=75.0, ge=0, le=100)
    description: str = ""


class PolicyUpdateRequest(BaseModel):
    rules: list[PolicyRule]


class PolicySuggestRequest(BaseModel):
    """A red-team finding to turn into a suggested containment policy rule."""

    content: str = Field(..., description="The attacker prompt / evaluated payload that triggered the finding")
    trigger_phrases: list[str] = Field(default_factory=list, description="Matched trigger phrases from the scan highlights")
    event_type: str = Field(default="PROMPT_INJECTION", description="Detector event type from the top security event")
    severity: str = Field(default="HIGH")
    risk_score: float = Field(default=80.0, ge=0, le=100)
    source: str | None = Field(default=None, description="Where the finding came from, e.g. attack template name")


class PolicySuggestResponse(BaseModel):
    suggested_rule: PolicyRule
    already_covered: bool = Field(description="True if an existing rule already matches this content")
    rationale: str


@router.get("/policies")
async def list_policies() -> dict[str, Any]:
    """Return current org policy rules."""
    if not POLICY_PATH.exists():
        return {"rules": [], "playbook_version": current_version() or 0}
    with POLICY_PATH.open(encoding="utf-8") as f:
        data = yaml.safe_load(f) or {"rules": []}
    data["playbook_version"] = current_version() or len(data.get("rules", []))
    return data


@router.put("/policies")
async def update_policies(payload: PolicyUpdateRequest) -> dict[str, Any]:
    """Replace org policy rules (YAML-backed)."""
    data = {"rules": [rule.model_dump() for rule in payload.rules]}
    version = _write_rules(data["rules"], trigger="manual_update", note="Full policy replace")
    return {"status": "updated", "rule_count": len(payload.rules), "playbook_version": version["version"]}


@router.post("/policies/rules")
async def add_policy_rule(rule: PolicyRule) -> dict[str, Any]:
    """Append a single org policy rule."""
    current = await list_policies()
    rules = current.get("rules", [])
    rules.append(rule.model_dump())
    version = _write_rules(rules, trigger="rule_add", note=f"Added rule {rule.name}")
    return {"status": "added", "rule_count": len(rules), "playbook_version": version["version"]}


@router.get("/policies/versions")
async def policy_versions(limit: int = 20) -> dict[str, Any]:
    """Git-log style playbook version history."""
    versions = list_versions(limit=limit)
    return {"current_version": current_version(), "versions": versions}


@router.get("/policies/versions/diff")
async def policy_version_diff(from_version: int, to_version: int) -> dict[str, Any]:
    """Diff two playbook snapshots (added / removed rules)."""
    return diff_versions(from_version, to_version)


def _synthesize_pattern(content: str, trigger_phrases: list[str]) -> str:
    """Build a case-insensitive regex from a finding's trigger phrases.

    Prefers the explicit trigger phrases surfaced by the scanner. Falls back to
    a short signature derived from the content so a rule is always suggested.
    """
    phrases = [p.strip() for p in trigger_phrases if p and p.strip()]
    if not phrases:
        # Fall back to the most distinctive words from the payload.
        words = re.findall(r"[a-zA-Z]{4,}", content.lower())
        phrases = words[:4] if words else ["suspicious"]

    # De-duplicate while preserving order, cap to keep the rule readable.
    seen: set[str] = set()
    unique: list[str] = []
    for phrase in phrases:
        if phrase.lower() not in seen:
            seen.add(phrase.lower())
            unique.append(phrase)
        if len(unique) >= 4:
            break

    alternation = "|".join(re.escape(p) for p in unique)
    return f"(?i)({alternation})"


def _existing_patterns() -> list[str]:
    if not POLICY_PATH.exists():
        return []
    with POLICY_PATH.open(encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    return [r.get("pattern", "") for r in data.get("rules", []) if r.get("pattern")]


@router.post("/policies/suggest", response_model=PolicySuggestResponse)
async def suggest_policy(payload: PolicySuggestRequest) -> PolicySuggestResponse:
    """Turn a red-team finding into a suggested containment policy rule.

    This is the "harden" half of the closed loop: a wargame / sandbox finding
    becomes a concrete rule the user can enforce with one click via
    ``POST /policies/rules``.
    """
    pattern = _synthesize_pattern(payload.content, payload.trigger_phrases)

    # Is this content already blocked by an existing rule?
    already_covered = False
    for existing in _existing_patterns():
        try:
            if re.search(existing, payload.content):
                already_covered = True
                break
        except re.error:
            continue

    label_source = payload.source or (payload.trigger_phrases[0] if payload.trigger_phrases else "finding")
    rule = PolicyRule(
        name=f"Block: {label_source}"[:80],
        pattern=pattern,
        event_type=payload.event_type or "PROMPT_INJECTION",
        severity=payload.severity or "HIGH",
        risk_score=payload.risk_score,
        description=(
            f"Auto-suggested from a red-team finding ({label_source}). "
            "Blocks prompts matching the attack's trigger phrases."
        ),
    )

    rationale = (
        "This attack is already covered by an existing policy rule."
        if already_covered
        else "No existing rule matches this attack. Add this rule to block it in production."
    )
    return PolicySuggestResponse(suggested_rule=rule, already_covered=already_covered, rationale=rationale)
