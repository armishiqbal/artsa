"""Ablation cache integration test."""

from src.services.benchmark_cache import get_cached_ablation, set_cached_ablation


def test_ablation_cache_roundtrip():
    payload = {"baseline": {"recall_at_80": 0.5}, "ablation": []}
    set_cached_ablation(payload)
    cached = get_cached_ablation()
    assert cached is not None
    assert cached["baseline"]["recall_at_80"] == 0.5
