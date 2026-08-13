"""Detector ablation harness smoke test."""

from src.benchmark.ablation import AblationHarness
from src.containment.engine import ContainmentEngine


def test_ablation_runs():
    harness = AblationHarness()
    report = harness.run_ablation()
    expected = len(ContainmentEngine.DETECTOR_NAMES)
    assert len(report.results) == expected
    assert report.baseline_recall >= 0
    payload = harness.to_ablation_dict(report)
    assert "ablation" in payload
    assert len(payload["ablation"]) == expected
