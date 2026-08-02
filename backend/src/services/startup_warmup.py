"""Background benchmark/ablation cache warm on API startup."""

from __future__ import annotations

import asyncio
import logging

from src.core.config import settings

logger = logging.getLogger(__name__)


def warm_benchmark_caches_sync() -> None:
    """Run benchmark + ablation harness and populate caches (blocking — run in thread)."""
    from src.benchmark.ablation import AblationHarness
    from src.benchmark.harness import BenchmarkHarness
    from src.services.benchmark_cache import get_cached_ablation, get_cached_benchmark, set_cached_ablation, set_cached_benchmark
    from src.services.prometheus_metrics import record_benchmark_run

    if get_cached_benchmark() is None:
        logger.info("Warming benchmark cache…")
        harness = BenchmarkHarness()
        report = harness.run()
        set_cached_benchmark(harness.to_dict(report))
        record_benchmark_run()
        logger.info("Benchmark cache warm complete (dataset=%s)", harness.dataset_version)

    if get_cached_ablation() is None:
        logger.info("Warming ablation cache…")
        ablation = AblationHarness()
        ablation_report = ablation.run_ablation()
        set_cached_ablation(ablation.to_ablation_dict(ablation_report))
        record_benchmark_run()
        logger.info("Ablation cache warm complete (%d detectors)", len(ablation_report.results))


async def warm_benchmark_caches_async() -> None:
    if settings.is_testing or not settings.WARM_BENCHMARK_ON_START:
        return
    try:
        await asyncio.to_thread(warm_benchmark_caches_sync)
    except Exception as exc:
        logger.warning("Benchmark cache warm skipped: %s", exc)
