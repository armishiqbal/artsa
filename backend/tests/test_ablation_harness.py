"""Detector ablation harness smoke test."""

from src.benchmark.ablation import AblationHarness


def test_ablation_runs():
    harness = AblationHarness()
    report = harness.run_ablation()
    assert len(report.results) == 5
    assert report.baseline_recall >= 0
    payload = harness.to_ablation_dict(report)
    assert "ablation" in payload
    assert len(payload["ablation"]) == 5
