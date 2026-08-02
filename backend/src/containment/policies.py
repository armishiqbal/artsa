"""Org-specific custom policy loader for rule-based detection."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml


def load_org_policies(path: str | Path | None = None) -> list[tuple[str, str, str, float, str]]:
    """Load custom detection patterns from YAML org policy file.

    Returns list of (regex, event_type, severity, risk_score, description) tuples.
    """
    if path is None:
        backend_dir = Path(__file__).resolve().parent.parent.parent.parent
        path = backend_dir / "configs" / "org_policies" / "default.yaml"

    policy_path = Path(path)
    if not policy_path.exists():
        return []

    with policy_path.open(encoding="utf-8") as f:
        data: dict[str, Any] = yaml.safe_load(f) or {}

    patterns: list[tuple[str, str, str, float, str]] = []
    for rule in data.get("rules", []):
        patterns.append(
            (
                rule["pattern"],
                rule.get("event_type", "SANDBOX_ESCAPE"),
                rule.get("severity", "HIGH"),
                float(rule.get("risk_score", 75.0)),
                rule.get("description", rule.get("name", "Custom org policy match")),
            )
        )
    return patterns
