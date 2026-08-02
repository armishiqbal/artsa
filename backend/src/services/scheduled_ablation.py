"""Periodic ablation refresh for observatory regression tracking."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from src.core.config import settings

logger = logging.getLogger(__name__)

_meta: dict[str, Any] = {
    "last_run_at": None,
    "next_run_at": None,
    "runs_total": 0,
}


def get_ablation_schedule_meta() -> dict[str, Any]:
    return {
        "enabled": settings.SCHEDULED_ABLATION_INTERVAL_SEC > 0,
        "interval_sec": settings.SCHEDULED_ABLATION_INTERVAL_SEC,
        "last_run_at": _meta["last_run_at"],
        "next_run_at": _meta["next_run_at"],
        "runs_total": _meta["runs_total"],
    }


def run_scheduled_ablation_sync() -> None:
    """Run ablation harness and refresh observatory cache (blocking)."""
    from src.benchmark.ablation import AblationHarness
    from src.services.benchmark_cache import set_cached_ablation
    from src.services.prometheus_metrics import record_benchmark_run

    ablation = AblationHarness()
    report = ablation.run_ablation()
    set_cached_ablation(ablation.to_ablation_dict(report))
    record_benchmark_run()

    now = datetime.now(timezone.utc)
    _meta["last_run_at"] = now.isoformat()
    _meta["runs_total"] = int(_meta["runs_total"]) + 1
    if settings.SCHEDULED_ABLATION_INTERVAL_SEC > 0:
        _meta["next_run_at"] = (now + timedelta(seconds=settings.SCHEDULED_ABLATION_INTERVAL_SEC)).isoformat()


async def scheduled_ablation_loop(interval_sec: int) -> None:
    """Background loop — sleep then refresh ablation cache."""
    while True:
        await asyncio.sleep(interval_sec)
        try:
            await asyncio.to_thread(run_scheduled_ablation_sync)
            logger.info("Scheduled ablation complete (run #%s)", _meta["runs_total"])
        except Exception as exc:
            logger.warning("Scheduled ablation failed: %s", exc)


async def start_scheduled_ablation() -> None:
    """Start periodic ablation when SCHEDULED_ABLATION_INTERVAL_SEC > 0."""
    interval = settings.SCHEDULED_ABLATION_INTERVAL_SEC
    if interval <= 0 or settings.is_testing:
        return

    now = datetime.now(timezone.utc)
    _meta["next_run_at"] = (now + timedelta(seconds=interval)).isoformat()
    asyncio.create_task(scheduled_ablation_loop(interval))
    logger.info("Scheduled ablation enabled (every %ds)", interval)
