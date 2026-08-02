"""Scheduled ablation service tests."""

from src.services.benchmark_cache import get_cached_ablation, invalidate_ablation_cache
from src.services.scheduled_ablation import get_ablation_schedule_meta, run_scheduled_ablation_sync


def test_run_scheduled_ablation_sync_populates_cache():
    invalidate_ablation_cache()
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
