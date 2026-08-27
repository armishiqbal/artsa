"""In-process ticker for weekly (or interval) baseline wargame schedules.

When ``BASELINE_SCHEDULE_TICK_SEC > 0``, the API process periodically runs due
schedules without an external cron. Cron ``POST /campaigns/baseline/tick`` still works.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from src.core.config import settings

logger = logging.getLogger(__name__)

_meta: dict[str, Any] = {
    "last_tick_at": None,
    "next_tick_at": None,
    "ticks_total": 0,
    "last_started": [],
}

_DEFAULT_MODELS = {
    "ollama": "llama3.2",
    "groq": "llama-3.1-8b-instant",
    "openai": "gpt-4o-mini",
    "deepseek": "deepseek-chat",
    "anthropic": "claude-3-5-haiku-latest",
}


def get_baseline_ticker_meta() -> dict[str, Any]:
    return {
        "enabled": settings.BASELINE_SCHEDULE_TICK_SEC > 0,
        "interval_sec": settings.BASELINE_SCHEDULE_TICK_SEC,
        "last_tick_at": _meta["last_tick_at"],
        "next_tick_at": _meta["next_tick_at"],
        "ticks_total": _meta["ticks_total"],
        "last_started": list(_meta["last_started"] or []),
    }


def _resolve_row_target(row: dict[str, Any]) -> tuple[str, str]:
    provider = row.get("provider")
    model = row.get("model")
    if provider:
        provider_s = str(provider)
        return provider_s, str(model or _DEFAULT_MODELS.get(provider_s, "gpt-4o-mini"))
    from src.api.routes.campaigns import _default_baseline_target

    picked_provider, picked_model = _default_baseline_target()
    if model:
        return picked_provider, str(model)
    return picked_provider, picked_model


async def run_due_baselines() -> list[dict[str, Any]]:
    """Start campaigns for all due schedules (all tenants)."""
    from src.api.routes.campaigns import RunCampaignRequest, execute_campaign_background
    from src.data.baseline_schedule_store import baseline_schedule_store
    from src.data.campaign_job_store import campaign_job_store

    started: list[dict[str, Any]] = []
    for row in baseline_schedule_store.due():
        tenant_id = str(row.get("tenant_id") or "default_org")
        try:
            provider, model = _resolve_row_target(row)
        except Exception as exc:
            started.append({"tenant_id": tenant_id, "error": str(exc)})
            continue

        campaign_id = str(uuid.uuid4())
        name = str(row.get("name") or "Weekly baseline")
        max_rounds = int(row.get("max_rounds") or 3)
        req = RunCampaignRequest(
            name=name,
            provider=provider,
            model=model,
            attack_profile="quick_scan",
            max_rounds=max_rounds,
            use_llm_judge=False,
        )
        campaign_job_store.create(
            campaign_id,
            name=req.name,
            provider=req.provider,
            model=req.model,
            attack_profile=req.attack_profile,
            max_rounds=req.max_rounds,
            request_json=req.model_dump(),
            tenant_id=tenant_id,
        )
        asyncio.create_task(asyncio.to_thread(execute_campaign_background, campaign_id, req))
        baseline_schedule_store.mark_ran(tenant_id, campaign_id)
        started.append(
            {
                "tenant_id": tenant_id,
                "campaign_id": campaign_id,
                "provider": provider,
                "model": model,
                "wargame_href": f"/campaigns/{campaign_id}",
            }
        )
    return started


async def baseline_schedule_loop(interval_sec: int) -> None:
    while True:
        await asyncio.sleep(interval_sec)
        try:
            started = await run_due_baselines()
            now = datetime.now(UTC)
            _meta["last_tick_at"] = now.isoformat()
            _meta["ticks_total"] = int(_meta["ticks_total"]) + 1
            _meta["next_tick_at"] = (now + timedelta(seconds=interval_sec)).isoformat()
            _meta["last_started"] = started
            if started:
                logger.info("Baseline ticker started %s campaign(s)", len(started))
            else:
                logger.debug("Baseline ticker: nothing due")
        except Exception as exc:
            logger.warning("Baseline schedule tick failed: %s", exc)


async def start_baseline_schedule_ticker() -> None:
    interval = settings.BASELINE_SCHEDULE_TICK_SEC
    if interval <= 0 or settings.is_testing:
        return
    now = datetime.now(UTC)
    _meta["next_tick_at"] = (now + timedelta(seconds=interval)).isoformat()
    asyncio.create_task(baseline_schedule_loop(interval))
    logger.info("Baseline schedule ticker enabled (every %ds)", interval)
