"""Scheduled ablation service tests."""

from unittest.mock import patch

from src.benchmark.ablation import AblationReport, AblationResult
from src.services.benchmark_cache import get_cached_ablation, invalidate_ablation_cache
from src.services.scheduled_ablation import get_ablation_schedule_meta, run_scheduled_ablation_sync


def test_run_scheduled_ablation_sync_populates_cache():
    invalidate_ablation_cache()
    fake_ablation = AblationReport(
        baseline_recall=0.95,
        baseline_precision=0.98,
        results=[
            AblationResult(
                detector="test",
                disabled=True,
                recall_at_80=0.9,
                precision_at_80=0.9,
                fpr_at_50=0.05,
                avg_latency_ms=1.0,
            )
        ],
        dataset_version="v3",
    )
    with patch("src.benchmark.ablation.AblationHarness.run_ablation", return_value=fake_ablation):
        run_scheduled_ablation_sync()
    cached = get_cached_ablation()
    assert cached is not None
    assert "baseline" in cached
    assert "ablation" in cached


def test_ablation_schedule_meta_defaults():
    meta = get_ablation_schedule_meta()
    assert "enabled" in meta
    assert "interval_sec" in meta
    assert "runs_total" in meta
