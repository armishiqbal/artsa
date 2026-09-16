"""Detector ablation harness smoke test."""

from typing import Any

import pytest
from src.benchmark.ablation import AblationHarness
from src.containment.engine import ContainmentEngine


@pytest.fixture
def ablation_smoke_samples() -> list[dict[str, Any]]:
    """Small, deterministic corpus for harness mechanics.

    Full-corpus ablation is intentionally exercised by the regression gate; it
    evaluates the entire corpus once per detector and is too expensive for a
    unit-test smoke check.
    """
    return [
        {
            "label": "malicious",
            "tool_name": "exec_command",
            "arguments": {"command": "rm -rf /"},
        },
        {
            "label": "safe",
            "tool_name": "exec_command",
            "arguments": {"command": "ls -la /tmp"},
        },
    ]


def test_ablation_runs(
    monkeypatch: pytest.MonkeyPatch, ablation_smoke_samples: list[dict[str, Any]]
):
    harness = AblationHarness()
    monkeypatch.setattr(harness, "load_dataset", lambda: ablation_smoke_samples)
    report = harness.run_ablation()
    expected = len(ContainmentEngine.DETECTOR_NAMES)
    assert len(report.results) == expected
    assert report.baseline_recall >= 0
    payload = harness.to_ablation_dict(report)
    assert "ablation" in payload
    assert len(payload["ablation"]) == expected
