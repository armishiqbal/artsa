"""Tests for MarkdownReportGenerator."""

import pytest
from pathlib import Path

from src.reporting.markdown_report import MarkdownReportGenerator
from src.models import (
    CampaignConfig,
    CampaignSummary,
    CampaignState,
    RoundResult,
    AttackPayload,
    AttackCategory,
    TargetResponse,
    JudgeScore,
    Verdict,
    Severity,
)


def _make_round(n: int) -> RoundResult:
    """Build a simple RoundResult for report testing."""
    return RoundResult(
        round_number=n,
        attack=AttackPayload(
            category=AttackCategory.PROMPT_INJECTION,
            name=f"Attack {n}",
            prompt="Test prompt",
            objective="Test",
        ),
        response=TargetResponse(response="Test response"),
        score=JudgeScore(
            verdict=Verdict.SUCCESS,
            attack_success_score=8,
            severity=Severity.HIGH,
            bypass_depth=3,
            information_leakage_score=7,
            defense_quality_score=3,
            reasoning="Test reasoning",
        ),
    )


class TestMarkdownReportGenerator:
    def test_generate_returns_nonempty_string(self, sample_campaign_summary, sample_campaign_config):
        """generate() returns a non-empty markdown string."""
        gen = MarkdownReportGenerator()
        rounds = [_make_round(1), _make_round(2)]
        report = gen.generate(sample_campaign_summary, rounds, sample_campaign_config)
        assert isinstance(report, str)
        assert len(report) > 100

    def test_generate_contains_campaign_name(self, sample_campaign_summary, sample_campaign_config):
        """Report contains the campaign name."""
        gen = MarkdownReportGenerator()
        rounds = [_make_round(1)]
        report = gen.generate(sample_campaign_summary, rounds, sample_campaign_config)
        assert "Test Campaign" in report

    def test_generate_contains_risk_level(self, sample_campaign_summary, sample_campaign_config):
        """Report contains a risk level indicator."""
        gen = MarkdownReportGenerator()
        rounds = [_make_round(1)]
        report = gen.generate(sample_campaign_summary, rounds, sample_campaign_config)
        assert "Risk Level" in report

    def test_save_creates_file(self, tmp_path):
        """save() writes the report to a file and returns the path."""
        gen = MarkdownReportGenerator()
        content = "# Test Report\n\nThis is a test report."
        path = gen.save("test-campaign", content, base_dir=str(tmp_path))
        assert Path(path).exists()
        assert Path(path).read_text() == content
