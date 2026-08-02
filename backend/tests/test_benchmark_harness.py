"""Benchmark harness tests."""

from src.benchmark.harness import BenchmarkHarness


def test_benchmark_harness_runs():
    harness = BenchmarkHarness()
    report = harness.run()
    assert report.total_samples >= 500
    assert len(report.thresholds) == 2
    assert report.thresholds[0].threshold in (50.0, 80.0)


def test_benchmark_recall_at_80():
    harness = BenchmarkHarness()
    report = harness.run()
    t80 = next(t for t in report.thresholds if t.threshold == 80.0)
    assert t80.recall >= 0.25
    assert t80.tp >= 1
    assert report.total_samples >= 500


def test_benchmark_fpr_at_50():
    harness = BenchmarkHarness()
    report = harness.run()
    t50 = next(t for t in report.thresholds if t.threshold == 50.0)
    assert t50.fpr <= 0.5
