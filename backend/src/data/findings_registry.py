"""Persist finding lifecycle status (promoted / deployed) server-side."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
REGISTRY_PATH = BACKEND_DIR / "data" / "findings_registry.json"


def _load() -> dict[str, Any]:
    if not REGISTRY_PATH.exists():
        return {"records": {}}
    try:
        return json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {"records": {}}


def _save(data: dict[str, Any]) -> None:
    REGISTRY_PATH.parent.mkdir(parents=True, exist_ok=True)
    REGISTRY_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")


def get_record(finding_id: str) -> dict[str, Any] | None:
    records = _load().get("records", {})
    row = records.get(finding_id)
    return dict(row) if isinstance(row, dict) else None


def set_promoted(
    finding_id: str,
    *,
    rule_name: str,
    playbook_version: int,
) -> dict[str, Any]:
    data = _load()
    records: dict[str, Any] = data.setdefault("records", {})
    record = {
        "status": "promoted",
        "promoted_at": datetime.now(UTC).isoformat(),
        "rule_name": rule_name,
        "playbook_version": playbook_version,
    }
    records[finding_id] = record
    _save(data)
    return record


def all_records() -> dict[str, dict[str, Any]]:
    raw = _load().get("records", {})
    return {k: dict(v) for k, v in raw.items() if isinstance(v, dict)}
