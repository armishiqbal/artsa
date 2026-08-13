"""Startup benchmark cache warm tests."""

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
    warm_benchmark_caches_sync()
    assert get_cached_benchmark() is not None
    assert get_cached_ablation() is not None
