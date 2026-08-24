"""JSON-backed playbook / org-policy version history."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
VERSIONS_PATH = BACKEND_DIR / "data" / "policy_versions.json"


def _load() -> dict[str, Any]:
    if not VERSIONS_PATH.exists():
        return {"current_version": 0, "versions": []}
    try:
        return json.loads(VERSIONS_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {"current_version": 0, "versions": []}


def _save(data: dict[str, Any]) -> None:
    VERSIONS_PATH.parent.mkdir(parents=True, exist_ok=True)
    VERSIONS_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")


def current_version() -> int:
    return int(_load().get("current_version", 0))


def list_versions(limit: int = 20) -> list[dict[str, Any]]:
    versions = _load().get("versions", [])
    return list(reversed(versions[-limit:]))


def snapshot_rules(
    rules: list[dict[str, Any]],
    *,
    trigger: str,
    finding_id: str | None = None,
    note: str | None = None,
) -> dict[str, Any]:
    """Append a new playbook version after rules change."""
    data = _load()
    next_version = int(data.get("current_version", 0)) + 1
    entry = {
        "version": next_version,
        "rule_count": len(rules),
        "rules": rules,
        "created_at": datetime.now(UTC).isoformat(),
        "trigger": trigger,
        "finding_id": finding_id,
        "note": note,
    }
    versions: list[dict[str, Any]] = data.get("versions", [])
    versions.append(entry)
    data["current_version"] = next_version
    data["versions"] = versions[-50:]
    _save(data)
    return entry


def get_version(version: int) -> dict[str, Any] | None:
    for entry in _load().get("versions", []):
        if int(entry.get("version", 0)) == version:
            return entry
    return None


def diff_versions(v1: int, v2: int) -> dict[str, Any]:
    a = get_version(v1)
    b = get_version(v2)
    if not a or not b:
        return {"added": [], "removed": [], "unchanged": []}
    names_a = {r.get("name") for r in a.get("rules", [])}
    names_b = {r.get("name") for r in b.get("rules", [])}
    added = [r for r in b.get("rules", []) if r.get("name") not in names_a]
    removed = [r for r in a.get("rules", []) if r.get("name") not in names_b]
    unchanged = [r for r in b.get("rules", []) if r.get("name") in names_a]
    return {"added": added, "removed": removed, "unchanged": unchanged, "from_version": v1, "to_version": v2}
