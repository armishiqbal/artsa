"""Campaign orchestration routes (unified from api-gateway)."""

from __future__ import annotations

import json
import logging
import uuid
from pathlib import Path
from typing import Any, Dict

import yaml
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel, Field

from src.core.config import settings
from src.data.campaign_job_store import campaign_job_store

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Campaigns"])

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent.parent


class RunCampaignRequest(BaseModel):
    name: str = "Cyber Wargame Run"
    provider: str = "groq"
    model: str = "llama-3.3-70b-versatile"
    attack_profile: str = "quick_scan"
    max_rounds: int = Field(default=10, ge=1, le=100)
    base_url: str | None = None
    use_llm_judge: bool | None = None  # None = respect configs/default_config.yaml


def _resolve_provider_api_key(provider: str) -> str | None:
    return settings.provider_key(provider)


def execute_campaign_background(campaign_id: str, req: RunCampaignRequest) -> None:
    job_store = campaign_job_store

    def on_round_complete(completed: int, total: int) -> None:
        job_store.update_progress(campaign_id, completed)

    try:
        from src.models import AttackCategory, AttackProfile, CampaignConfig, TargetConfig
        from src.orchestrator.campaign_manager import CampaignManager

        config_path = BACKEND_DIR / "configs" / "default_config.yaml"
        with config_path.open(encoding="utf-8") as f:
            app_config = yaml.safe_load(f)

        api_key = _resolve_provider_api_key(req.provider)
        if not api_key and req.provider not in ("ollama", "local"):
            raise ValueError(
                f"No API key configured for provider '{req.provider}'. "
                "Add the key in .env or use Providers page."
            )

        target_cfg = TargetConfig(
            name=f"Target-{req.provider}",
            provider=req.provider,
            model=req.model,
            api_key=api_key,
            base_url=req.base_url,
        )
        categories = (
            [AttackCategory.PROMPT_INJECTION, AttackCategory.JAILBREAK, AttackCategory.SYSTEM_PROMPT_EXTRACTION]
            if req.attack_profile == "quick_scan"
            else [
                AttackCategory.PROMPT_INJECTION,
                AttackCategory.JAILBREAK,
                AttackCategory.SYSTEM_PROMPT_EXTRACTION,
                AttackCategory.DATA_EXTRACTION,
            ]
        )
        profile_cfg = AttackProfile(name=req.attack_profile, categories=categories)
        camp_cfg = CampaignConfig(
            id=campaign_id,
            name=req.name,
            target=target_cfg,
            attack_profile=profile_cfg,
            max_rounds=req.max_rounds,
        )
        if req.use_llm_judge is not None:
            app_config["artsa"]["judge"]["use_llm"] = req.use_llm_judge
        manager = CampaignManager(config=camp_cfg, app_config=app_config)
        summary = manager.run(on_round_complete=on_round_complete)
        job_store.complete(campaign_id, summary.model_dump(mode="json"))
    except Exception as exc:
        logger.exception("Campaign %s failed: %s", campaign_id, exc)
        job_store.fail(campaign_id, str(exc))


@router.get("/campaigns")
async def list_campaigns() -> Dict[str, Any]:
    results_dir = BACKEND_DIR / "data" / "results"
    campaigns = []

    for job in campaign_job_store.list_jobs(limit=100):
        campaigns.append(
            {
                "id": job["id"],
                "name": job["name"],
                "status": job["status"],
                "provider": job["provider"],
                "model": job["model"],
                "rounds_completed": job["rounds_completed"],
                "total_rounds": job["max_rounds"],
                "summary": job.get("summary_json"),
                "error": job.get("error"),
            }
        )

    if results_dir.exists():
        for d in sorted(results_dir.iterdir(), reverse=True):
            if not d.is_dir() or not (d / "summary.json").exists():
                continue
            cid = d.name
            if any(c["id"] == cid for c in campaigns):
                continue
            try:
                with (d / "summary.json").open(encoding="utf-8") as f:
                    summary_data = json.load(f)
                campaigns.append(
                    {
                        "id": cid,
                        "name": summary_data.get("name", f"Campaign {cid[:8]}"),
                        "status": "COMPLETED",
                        "provider": summary_data.get("provider", "groq"),
                        "model": summary_data.get("model", "llama-3.3-70b-versatile"),
                        "rounds_completed": summary_data.get(
                            "completed_rounds", summary_data.get("total_rounds", 0)
                        ),
                        "total_rounds": summary_data.get("total_rounds", 0),
                        "summary": summary_data,
                    }
                )
            except Exception:
                pass

    return {"campaigns": campaigns}


@router.post("/campaigns/run")
async def start_campaign(req: RunCampaignRequest, background_tasks: BackgroundTasks) -> Dict[str, Any]:
    campaign_id = str(uuid.uuid4())
    campaign_job_store.create(
        campaign_id,
        name=req.name,
        provider=req.provider,
        model=req.model,
        attack_profile=req.attack_profile,
        max_rounds=req.max_rounds,
        request_json=req.model_dump(),
    )
    background_tasks.add_task(execute_campaign_background, campaign_id, req)
    return {
        "campaign_id": campaign_id,
        "message": f"Wargame campaign '{req.name}' started successfully.",
        "status": "RUNNING",
    }


@router.get("/campaigns/{campaign_id}")
async def get_campaign_detail(campaign_id: str) -> Dict[str, Any]:
    job = campaign_job_store.get(campaign_id)
    if job:
        return {
            "id": campaign_id,
            "status": job["status"],
            "request": job.get("request_json", {}),
            "rounds_completed": job["rounds_completed"],
            "total_rounds": job["max_rounds"],
            "summary": job.get("summary_json"),
            "error": job.get("error"),
        }

    results_dir = BACKEND_DIR / "data" / "results" / campaign_id
    if results_dir.exists() and (results_dir / "summary.json").exists():
        with (results_dir / "summary.json").open(encoding="utf-8") as f:
            summary_data = json.load(f)
        report_md = ""
        if (results_dir / "report.md").exists():
            report_md = (results_dir / "report.md").read_text(encoding="utf-8")
        return {
            "id": campaign_id,
            "status": "COMPLETED",
            "summary": summary_data,
            "report_markdown": report_md,
        }

    raise HTTPException(status_code=404, detail="Campaign not found")
