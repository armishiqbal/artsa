"""Tighter per-endpoint quotas for expensive Situation / baseline calls.

Global ARTSA_RATE_LIMIT_RPM still applies to all traffic. These buckets stop a
single tenant from burning LLM spend or launching overlapping wargames via
situation evaluate / baseline start specifically.
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, status

from src.core.config import settings


class EndpointQuotaStore:
    """In-process sliding window: key → timestamps of recent consumes."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._windows: dict[str, deque[float]] = defaultdict(deque)

    def reset(self) -> None:
        with self._lock:
            self._windows.clear()

    def consume(self, key: str, *, limit: int, window_sec: int) -> None:
        """Record one use. Raises HTTP 429 when over limit (limit<=0 disables)."""
        if limit <= 0:
            return
        now = time.monotonic()
        cutoff = now - window_sec
        with self._lock:
            q = self._windows[key]
            while q and q[0] < cutoff:
                q.popleft()
            if len(q) >= limit:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=(
                        f"Quota exceeded for {key.split(':', 1)[-1]} "
                        f"({limit} per {window_sec}s). Wait and retry."
                    ),
                    headers={"Retry-After": str(max(1, int(window_sec)))},
                )
            q.append(now)


endpoint_quota_store = EndpointQuotaStore()


def enforce_situation_quota(tenant_id: str, *, use_llm: bool = False) -> None:
    """Cap free-text evaluate/classify (stricter when LLM refine is on)."""
    tid = tenant_id or "default_org"
    endpoint_quota_store.consume(
        f"{tid}:situation_eval",
        limit=settings.SITUATION_EVAL_PER_MIN,
        window_sec=60,
    )
    if use_llm:
        endpoint_quota_store.consume(
            f"{tid}:situation_llm",
            limit=settings.SITUATION_LLM_PER_MIN,
            window_sec=60,
        )


def enforce_baseline_start_quota(tenant_id: str) -> None:
    """Cap on-demand baseline launches (ticker / cron bypass this helper)."""
    tid = tenant_id or "default_org"
    endpoint_quota_store.consume(
        f"{tid}:baseline_start",
        limit=settings.BASELINE_STARTS_PER_HOUR,
        window_sec=3600,
    )
