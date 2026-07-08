"""Tests for ResultsStore — JSON file-based storage."""

import pytest

from src.data.results_store import ResultsStore
from src.models import (
    AttackCategory,
    AttackPayload,
    CampaignConfig,
    CampaignState,
    JudgeScore,
    RoundResult,
    Severity,
    TargetResponse,
    Verdict,
)


def _make_round(round_number: int = 1, verdict: Verdict = Verdict.SUCCESS, score: int = 8) -> RoundResult:
    """Build a RoundResult for testing."""
    return RoundResult(
        round_number=round_number,
        attack=AttackPayload(
            category=AttackCategory.PROMPT_INJECTION,
            name=f"Attack {round_number}",
            prompt="Test prompt",
            objective="Test objective",
        ),
        response=TargetResponse(response="Test response"),
        score=JudgeScore(
            verdict=verdict,
            attack_success_score=score,
            severity=Severity.MEDIUM,
            bypass_depth=1,
            information_leakage_score=score,
            defense_quality_score=10 - score,
        ),
    )


class TestResultsStore:
    def test_save_and_load_rounds(self, tmp_path):
        """Saved rounds can be loaded back correctly."""
        store = ResultsStore(data_dir=str(tmp_path))
        campaign_id = "test-campaign"
        
        r1 = _make_round(1, Verdict.SUCCESS, 8)
        r2 = _make_round(2, Verdict.BLOCKED, 0)
        store.save_round(campaign_id, r1)
        store.save_round(campaign_id, r2)
        
        loaded = store.load_rounds(campaign_id)
        assert len(loaded) == 2
        assert loaded[0].round_number == 1
        assert loaded[1].round_number == 2

    def test_load_rounds_empty_returns_list(self, tmp_path):
        """Loading rounds for a campaign with no data returns empty list."""
        store = ResultsStore(data_dir=str(tmp_path))
        loaded = store.load_rounds("nonexistent-campaign")
        assert loaded == []

    def test_generate_summary_verdict_counts(self, tmp_path):
        """generate_summary correctly counts verdicts."""
        store = ResultsStore(data_dir=str(tmp_path))
        campaign_id = "summary-test"
        config = CampaignConfig(id=campaign_id, name="Summary Test", max_rounds=5)
        
        store.save_round(campaign_id, _make_round(1, Verdict.SUCCESS, 9))
        store.save_round(campaign_id, _make_round(2, Verdict.BLOCKED, 0))
        store.save_round(campaign_id, _make_round(3, Verdict.PARTIAL, 5))
        store.save_round(campaign_id, _make_round(4, Verdict.SUCCESS, 8))
        store.save_round(campaign_id, _make_round(5, Verdict.BLOCKED, 0))
        
        summary = store.generate_summary(campaign_id, config)
        assert summary.results_by_verdict["SUCCESS"] == 2
        assert summary.results_by_verdict["BLOCKED"] == 2
        assert summary.results_by_verdict["PARTIAL"] == 1

    def test_generate_summary_category_keys(self, tmp_path):
        """Category breakdown contains 'success', 'partial', 'blocked' keys."""
        store = ResultsStore(data_dir=str(tmp_path))
        campaign_id = "cat-keys-test"
        config = CampaignConfig(id=campaign_id, name="Category Test", max_rounds=3)
        
        store.save_round(campaign_id, _make_round(1, Verdict.SUCCESS, 9))
        store.save_round(campaign_id, _make_round(2, Verdict.BLOCKED, 0))
        store.save_round(campaign_id, _make_round(3, Verdict.PARTIAL, 5))
        
        summary = store.generate_summary(campaign_id, config)
        for cat_data in summary.results_by_category.values():
            assert "success" in cat_data
            assert "partial" in cat_data
            assert "blocked" in cat_data

    def test_generate_summary_averages(self, tmp_path):
        """generate_summary computes correct averages."""
        store = ResultsStore(data_dir=str(tmp_path))
        campaign_id = "avg-test"
        config = CampaignConfig(id=campaign_id, name="Avg Test", max_rounds=2)
        
        store.save_round(campaign_id, _make_round(1, Verdict.SUCCESS, 10))
        store.save_round(campaign_id, _make_round(2, Verdict.BLOCKED, 0))
        
        summary = store.generate_summary(campaign_id, config)
        assert summary.avg_attack_success == 5.0  # (10+0)/2
        assert summary.completed_rounds == 2

    def test_save_campaign_config(self, tmp_path):
        """save_campaign_config writes a config.json file."""
        store = ResultsStore(data_dir=str(tmp_path))
        config = CampaignConfig(id="cfg-test", name="Config Test")
        store.save_campaign_config(config)
        
        config_path = tmp_path / "cfg-test" / "config.json"
        assert config_path.exists()
        assert "Config Test" in config_path.read_text()
