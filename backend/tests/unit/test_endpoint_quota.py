"""Phase 6 — endpoint quotas for situations + baseline starts."""

import pytest
from fastapi import HTTPException

from src.services.endpoint_quota import (
    EndpointQuotaStore,
    endpoint_quota_store,
    enforce_baseline_start_quota,
    enforce_situation_quota,
)


@pytest.fixture(autouse=True)
def _clear_quotas():
    endpoint_quota_store.reset()
    yield
    endpoint_quota_store.reset()


def test_situation_quota_allows_under_limit(monkeypatch):
    from src.core.config import settings

    monkeypatch.setattr(settings, "SITUATION_EVAL_PER_MIN", 3)
    monkeypatch.setattr(settings, "SITUATION_LLM_PER_MIN", 10)
    enforce_situation_quota("t1")
    enforce_situation_quota("t1")
    enforce_situation_quota("t1")


def test_situation_quota_blocks_over_limit(monkeypatch):
    from src.core.config import settings

    monkeypatch.setattr(settings, "SITUATION_EVAL_PER_MIN", 2)
    monkeypatch.setattr(settings, "SITUATION_LLM_PER_MIN", 10)
    enforce_situation_quota("t1")
    enforce_situation_quota("t1")
    with pytest.raises(HTTPException) as exc:
        enforce_situation_quota("t1")
    assert exc.value.status_code == 429


def test_situation_llm_quota_is_stricter(monkeypatch):
    from src.core.config import settings

    monkeypatch.setattr(settings, "SITUATION_EVAL_PER_MIN", 100)
    monkeypatch.setattr(settings, "SITUATION_LLM_PER_MIN", 1)
    enforce_situation_quota("t1", use_llm=True)
    with pytest.raises(HTTPException) as exc:
        enforce_situation_quota("t1", use_llm=True)
    assert exc.value.status_code == 429


def test_quotas_are_per_tenant(monkeypatch):
    from src.core.config import settings

    monkeypatch.setattr(settings, "SITUATION_EVAL_PER_MIN", 1)
    enforce_situation_quota("a")
    enforce_situation_quota("b")  # other tenant still ok
    with pytest.raises(HTTPException):
        enforce_situation_quota("a")


def test_baseline_quota_blocks_over_limit(monkeypatch):
    from src.core.config import settings

    monkeypatch.setattr(settings, "BASELINE_STARTS_PER_HOUR", 2)
    enforce_baseline_start_quota("t1")
    enforce_baseline_start_quota("t1")
    with pytest.raises(HTTPException) as exc:
        enforce_baseline_start_quota("t1")
    assert exc.value.status_code == 429
    assert "baseline" in str(exc.value.detail).lower()


def test_zero_limit_disables_quota(monkeypatch):
    from src.core.config import settings

    monkeypatch.setattr(settings, "BASELINE_STARTS_PER_HOUR", 0)
    for _ in range(20):
        enforce_baseline_start_quota("t1")


def test_quota_includes_retry_after_header(monkeypatch):
    from src.core.config import settings
    from src.services.endpoint_quota import enforce_baseline_start_quota, endpoint_quota_store

    endpoint_quota_store.reset()
    monkeypatch.setattr(settings, "BASELINE_STARTS_PER_HOUR", 1)
    enforce_baseline_start_quota("t1")
    with pytest.raises(HTTPException) as exc:
        enforce_baseline_start_quota("t1")
    assert exc.value.status_code == 429
    assert exc.value.headers is not None
    assert "Retry-After" in exc.value.headers

