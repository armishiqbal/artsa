"""Tests for in-process baseline ticker helpers."""

from src.services.scheduled_baseline import _resolve_row_target, get_baseline_ticker_meta


def test_resolve_row_target_explicit():
    provider, model = _resolve_row_target({"provider": "openai", "model": None})
    assert provider == "openai"
    assert model == "gpt-4o-mini"


def test_ticker_meta_shape():
    meta = get_baseline_ticker_meta()
    assert "enabled" in meta
    assert "interval_sec" in meta
    assert "ticks_total" in meta
