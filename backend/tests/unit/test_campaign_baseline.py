"""Phase 3 baseline campaign route — auto quick scan onboarding."""

import asyncio
from unittest.mock import MagicMock, patch

from fastapi import BackgroundTasks

from src.api.routes.campaigns import (
    BaselineCampaignRequest,
    RunCampaignRequest,
    _mutation_settings,
    _resolve_attack_categories,
    start_baseline_campaign,
)
from src.models import AttackCategory


def test_baseline_uses_explicit_provider():
    bg = BackgroundTasks()
    with patch("src.api.routes.campaigns.campaign_job_store") as store, patch(
        "src.api.routes.campaigns.execute_campaign_background"
    ):
        store.create = MagicMock()
        result = asyncio.run(
            start_baseline_campaign(
                background_tasks=bg,
                tenant_id="t1",
                payload=BaselineCampaignRequest(
                    provider="ollama",
                    model="llama3.2",
                    max_rounds=2,
                ),
            )
        )
    assert result["phase"] == 3
    assert result["provider"] == "ollama"
    assert result["model"] == "llama3.2"
    assert result["status"] == "RUNNING"
    assert "campaign_id" in result
    assert "/red-team/monitor/" in result["wargame_href"]


def test_baseline_passes_attack_categories():
    bg = BackgroundTasks()
    with patch("src.api.routes.campaigns.campaign_job_store") as store, patch(
        "src.api.routes.campaigns.execute_campaign_background"
    ):
        store.create = MagicMock()
        result = asyncio.run(
            start_baseline_campaign(
                background_tasks=bg,
                tenant_id="t1",
                payload=BaselineCampaignRequest(
                    provider="ollama",
                    model="llama3.2",
                    max_rounds=4,
                    categories=["Prompt Injection", "DEX"],
                    intensity="High",
                    target_agent="Support Bot",
                ),
            )
        )
    assert result["attack_profile"] == "custom"
    assert result["categories"] == ["Prompt Injection", "DEX"]
    assert result["intensity"] == "High"
    req_json = store.create.call_args.kwargs["request_json"]
    assert req_json["categories"] == ["Prompt Injection", "DEX"]
    assert req_json["target_agent"] == "Support Bot"
    assert store.create.called


def test_resolve_attack_categories_from_labels_and_codes():
    cats = _resolve_attack_categories("quick_scan", ["Tool Abuse", "SPE"])
    values = {c.value for c in cats}
    assert "PEX" in values
    assert "SPE" in values


def test_resolve_defaults_quick_scan():
    cats = _resolve_attack_categories("quick_scan", None)
    assert AttackCategory.PROMPT_INJECTION in cats
    assert AttackCategory.JAILBREAK in cats


def test_mutation_settings_from_intensity():
    assert _mutation_settings("Low", None, None) == (False, 0)
    assert _mutation_settings("Med", None, None) == (True, 2)
    assert _mutation_settings("High", None, None) == (True, 3)
    assert _mutation_settings(None, False, 1) == (False, 1)


def test_run_request_accepts_categories():
    req = RunCampaignRequest(
        name="t",
        categories=["DPI", "MSE"],
        intensity="Med",
        max_rounds=5,
    )
    assert req.categories == ["DPI", "MSE"]
    assert req.intensity == "Med"
