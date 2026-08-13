"""Benchmark result cache for observatory and API."""

from __future__ import annotations

import time
from typing import Any

from src.core.config import settings

_cache: dict[str, Any] = {"payload": None, "expires_at": 0.0, "last_hit": False}
_ablation_cache: dict[str, Any] = {"payload": None, "expires_at": 0.0}


def get_cached_benchmark() -> dict[str, Any] | None:
    if _cache["payload"] is not None and time.time() < _cache["expires_at"]:
        _cache["last_hit"] = True
        return _cache["payload"]
    _cache["last_hit"] = False
    return None


def set_cached_benchmark(payload: dict[str, Any]) -> None:
    _cache["payload"] = payload
    _cache["expires_at"] = time.time() + settings.BENCHMARK_CACHE_TTL_SEC
    _cache["last_hit"] = False


def benchmark_cache_was_hit() -> bool:
    return bool(_cache.get("last_hit"))


def invalidate_benchmark_cache() -> None:
    _cache["payload"] = None
    _cache["expires_at"] = 0.0


def get_cached_ablation() -> dict[str, Any] | None:
    if _ablation_cache["payload"] is not None and time.time() < _ablation_cache["expires_at"]:
        return _ablation_cache["payload"]
    return None


def set_cached_ablation(payload: dict[str, Any]) -> None:
    _ablation_cache["payload"] = payload
    _ablation_cache["expires_at"] = time.time() + settings.BENCHMARK_CACHE_TTL_SEC


def invalidate_ablation_cache() -> None:
    _ablation_cache["payload"] = None
    _ablation_cache["expires_at"] = 0.0
