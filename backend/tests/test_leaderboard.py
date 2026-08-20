"""Tests for Phase 3.3/3.4 — community submissions, contamination guard, leaderboard."""

from __future__ import annotations

import pytest
from src.benchmark.leaderboard import (
    SubmissionError,
    contamination_reason,
    leaderboard,
    record_entry,
    submit_sample,
    validate_sample,
)


@pytest.fixture(autouse=True)
def _isolated_storage(tmp_path, monkeypatch) -> None:
    """Point the JSON stores at a temp dir so tests never touch real data."""
    monkeypatch.setattr("src.benchmark.leaderboard.SUBMISSIONS_PATH", tmp_path / "subs.json")
    monkeypatch.setattr("src.benchmark.leaderboard.LEADERBOARD_PATH", tmp_path / "board.json")


def _sample(**overrides) -> dict:
    base = {
        "label": "malicious",
        "class": "multilingual",
        "tool_name": "inject_prompt",
        "arguments": {"payload": "unique novel attack phrase xyztoken123"},
        "note": "test",
    }
    base.update(overrides)
    return base


# ── schema validation ────────────────────────────────────────────────────────


def test_validate_sample_rejects_bad_schema() -> None:
    assert validate_sample({}) is not None
    assert validate_sample({"label": "bogus", "tool_name": "x", "arguments": {"a": 1}}) is not None
    assert (
        validate_sample({"label": "malicious", "tool_name": "", "arguments": {"a": 1}}) is not None
    )
    assert validate_sample({"label": "malicious", "tool_name": "x", "arguments": {}}) is not None
    assert (
        validate_sample(
            {"label": "safe", "tool_name": "read_file", "arguments": {"path": "/tmp/x"}}
        )
        is None
    )


# ── contamination guard (3.4) ────────────────────────────────────────────────


def _golden_malicious() -> dict:
    import json as _json
    from pathlib import Path

    golden_path = Path(__file__).resolve().parent.parent / "benchmarks" / "golden_set.json"
    with golden_path.open(encoding="utf-8") as fh:
        golden = _json.load(fh)
    return next(s for s in golden["samples"] if s["label"] == "malicious")


def test_exact_duplicate_of_reference_sample_rejected() -> None:
    # An exact copy of a golden-set sample must be rejected by the guard.
    malicious = _golden_malicious()
    sample = {
        "label": "malicious",
        "tool_name": malicious["tool_name"],
        "arguments": malicious["arguments"],
    }
    reason = contamination_reason(sample)
    assert reason is not None, "exact reference duplicate must be rejected"
    assert "too similar" in reason


def test_fresh_sample_passes_guard() -> None:
    assert contamination_reason(_sample()) is None


# ── submission intake ────────────────────────────────────────────────────────


def test_submit_accepts_fresh_sample() -> None:
    record = submit_sample(_sample(), source="community")
    assert record["id"]
    assert record["source"] == "community"
    assert (
        len(
            __import__(
                "src.benchmark.leaderboard", fromlist=["accepted_samples"]
            ).accepted_samples()
        )
        == 1
    )


def test_submit_rejects_duplicate() -> None:
    submit_sample(_sample(), source="a")
    with pytest.raises(SubmissionError, match="exact duplicate"):
        submit_sample(_sample(), source="b")


def test_submit_rejects_contaminated_sample() -> None:
    malicious = _golden_malicious()
    with pytest.raises(SubmissionError, match="too similar"):
        submit_sample(
            {
                "label": "malicious",
                "tool_name": malicious["tool_name"],
                "arguments": malicious["arguments"],
            },
            source="attacker",
        )


# ── leaderboard ──────────────────────────────────────────────────────────────


def test_leaderboard_ranks_by_recall_desc_then_fpr_asc() -> None:
    record_entry(
        "alpha",
        recall80=0.8,
        recall50=0.9,
        fpr50=0.2,
        set_name="community-submissions",
        scored_samples=50,
    )
    record_entry(
        "beta",
        recall80=0.9,
        recall50=0.95,
        fpr50=0.1,
        set_name="community-submissions",
        scored_samples=50,
    )
    record_entry(
        "gamma",
        recall80=0.9,
        recall50=0.95,
        fpr50=0.3,
        set_name="community-submissions",
        scored_samples=50,
    )
    board = leaderboard()
    assert [e["provider"] for e in board] == ["beta", "gamma", "alpha"]


def test_leaderboard_entry_replaced_for_same_provider() -> None:
    record_entry(
        "artsa",
        recall80=0.5,
        recall50=0.6,
        fpr50=0.1,
        set_name="community-submissions",
        scored_samples=10,
    )
    record_entry(
        "artsa",
        recall80=0.7,
        recall50=0.8,
        fpr50=0.05,
        set_name="community-submissions",
        scored_samples=20,
    )
    board = leaderboard("community-submissions")
    artsa = [e for e in board if e["provider"] == "artsa"]
    assert len(artsa) == 1
    assert artsa[0]["recall@80"] == 0.7
