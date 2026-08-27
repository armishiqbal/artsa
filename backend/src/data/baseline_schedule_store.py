"""File-backed weekly baseline scan schedules (Phase 4).

Cron or an admin can call ``POST /campaigns/baseline/tick`` to run due jobs.
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

_DEFAULT_PATH = Path(__file__).resolve().parents[2] / "data" / "baseline_schedules.json"


class BaselineScheduleStore:
    def __init__(self, path: Path | None = None) -> None:
        self.path = path or _DEFAULT_PATH

    def _load(self) -> dict[str, Any]:
        if not self.path.exists():
            return {"schedules": []}
        try:
            return json.loads(self.path.read_text(encoding="utf-8"))
        except Exception as exc:
            logger.warning("Failed to read baseline schedules: %s", exc)
            return {"schedules": []}

    def _save(self, data: dict[str, Any]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(data, indent=2), encoding="utf-8")

    def get(self, tenant_id: str = "default_org") -> dict[str, Any] | None:
        for row in self._load().get("schedules", []):
            if row.get("tenant_id") == tenant_id:
                return row
        return None

    def upsert(
        self,
        *,
        tenant_id: str = "default_org",
        enabled: bool = True,
        interval_days: int = 7,
        provider: str | None = None,
        model: str | None = None,
        max_rounds: int = 3,
        name: str = "Weekly baseline",
    ) -> dict[str, Any]:
        data = self._load()
        schedules: list[dict[str, Any]] = list(data.get("schedules") or [])
        now = datetime.now(UTC)
        existing = next((s for s in schedules if s.get("tenant_id") == tenant_id), None)
        if existing:
            existing.update(
                {
                    "enabled": enabled,
                    "interval_days": max(1, interval_days),
                    "provider": provider,
                    "model": model,
                    "max_rounds": max_rounds,
                    "name": name,
                    "updated_at": now.isoformat(),
                }
            )
            row = existing
        else:
            row = {
                "id": str(uuid.uuid4()),
                "tenant_id": tenant_id,
                "enabled": enabled,
                "interval_days": max(1, interval_days),
                "provider": provider,
                "model": model,
                "max_rounds": max_rounds,
                "name": name,
                "created_at": now.isoformat(),
                "updated_at": now.isoformat(),
                "last_run_at": None,
                "next_run_at": now.isoformat(),
                "last_campaign_id": None,
            }
            schedules.append(row)
        data["schedules"] = schedules
        self._save(data)
        return row

    def mark_ran(self, tenant_id: str, campaign_id: str) -> dict[str, Any] | None:
        data = self._load()
        now = datetime.now(UTC)
        for row in data.get("schedules", []):
            if row.get("tenant_id") != tenant_id:
                continue
            days = int(row.get("interval_days") or 7)
            row["last_run_at"] = now.isoformat()
            row["last_campaign_id"] = campaign_id
            row["next_run_at"] = (now + timedelta(days=days)).isoformat()
            self._save(data)
            return row
        return None

    def due(self, now: datetime | None = None) -> list[dict[str, Any]]:
        now = now or datetime.now(UTC)
        due_rows: list[dict[str, Any]] = []
        for row in self._load().get("schedules", []):
            if not row.get("enabled"):
                continue
            next_raw = row.get("next_run_at")
            if not next_raw:
                due_rows.append(row)
                continue
            try:
                next_at = datetime.fromisoformat(str(next_raw).replace("Z", "+00:00"))
            except ValueError:
                due_rows.append(row)
                continue
            if next_at.tzinfo is None:
                next_at = next_at.replace(tzinfo=UTC)
            if next_at <= now:
                due_rows.append(row)
        return due_rows


baseline_schedule_store = BaselineScheduleStore()
