"""Tests for Phase 4 baseline schedule store."""

from datetime import UTC, datetime, timedelta
from pathlib import Path

from src.data.baseline_schedule_store import BaselineScheduleStore


def test_upsert_and_due(tmp_path: Path):
    store = BaselineScheduleStore(path=tmp_path / "sched.json")
    row = store.upsert(tenant_id="t1", enabled=True, interval_days=7)
    assert row["tenant_id"] == "t1"
    assert store.get("t1")["enabled"] is True

    # Force due
    data = store._load()
    data["schedules"][0]["next_run_at"] = (datetime.now(UTC) - timedelta(hours=1)).isoformat()
    store._save(data)
    due = store.due()
    assert len(due) == 1

    marked = store.mark_ran("t1", "camp-1")
    assert marked["last_campaign_id"] == "camp-1"
    assert store.due() == []
