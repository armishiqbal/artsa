"""Startup benchmark cache warm tests."""

from unittest.mock import patch

from src.benchmark.ablation import AblationReport, AblationResult
from src.benchmark.harness import BenchmarkReport, ThresholdMetrics
from src.services.benchmark_cache import (
    get_cached_ablation,
    get_cached_benchmark,
    invalidate_ablation_cache,
    invalidate_benchmark_cache,
)
from src.services.startup_warmup import warm_benchmark_caches_sync


def test_warm_benchmark_caches_populates_cache():
    invalidate_benchmark_cache()
    invalidate_ablation_cache()
    fake_bench = BenchmarkReport(
        total_samples=10,
        thresholds=[ThresholdMetrics(threshold=80.0, precision=1.0, recall=1.0, fpr=0.0, tp=10, fp=0, tn=0, fn=0)],
        avg_latency_ms=1.2,
    )
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
    with patch("src.benchmark.harness.BenchmarkHarness.run", return_value=fake_bench), \
         patch("src.benchmark.ablation.AblationHarness.run_ablation", return_value=fake_ablation):
        warm_benchmark_caches_sync()
    assert get_cached_benchmark() is not None
    assert get_cached_ablation() is not None
