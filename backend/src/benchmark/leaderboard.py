"""Phase 3.3/3.4 — leaderboard + community sample submission intake.

Community pipeline ("HuggingFace of agent security"): third parties submit
attack samples; every submission passes a CONTAMINATION GUARD (3.4) that
rejects samples too similar to the public/generated sets (embedding similarity
>= 0.85) or exact duplicates — so the leaderboard set cannot be poisoned by
re-submitting what the guardrail already memorized. Accepted samples are scored
through the containment engine and ranked on the leaderboard.

Storage is JSON-file backed (``backend/data/``) — no DB migrations, CI-safe.

Honesty: the guard uses the configured embedding backend (hash in tests, real
ONNX locally — run with ``ARTSA_EMBEDDING_MODEL=local-bge-multilingual`` for a
semantic guard).
"""

from __future__ import annotations

import json
import time
import uuid
from pathlib import Path

from src.data.embedding_manager import HighAccuracy1024EmbeddingFunction, cosine_similarity

_BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
SUBMISSIONS_PATH = _BACKEND_ROOT / "data" / "benchmark_submissions.json"
LEADERBOARD_PATH = _BACKEND_ROOT / "data" / "leaderboard.json"

# Reference sets the contamination guard checks against.
_REFERENCE_SETS = (
    ("golden", _BACKEND_ROOT / "benchmarks" / "golden_set.json"),
    ("independent", _BACKEND_ROOT / "benchmarks" / "independent_set.json"),
    ("generated", _BACKEND_ROOT / "benchmarks" / "labeled_dataset_v3.json"),
)

SIMILARITY_CAP = 0.85
_VALID_LABELS = ("malicious", "safe")


class SubmissionError(Exception):
    """Raised when a submission is rejected (with a human-readable reason)."""


def _load_json(path: Path, default: list) -> list:
    if not path.exists():
        return default
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else default
    except (json.JSONDecodeError, OSError):
        return default


def _save_json(path: Path, data: list) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=1, ensure_ascii=False), encoding="utf-8")


def _reference_texts() -> list[tuple[str, str, str]]:
    """(set_name, tool_name, arguments_text) for every reference sample."""
    out: list[tuple[str, str, str]] = []
    for set_name, path in _REFERENCE_SETS:
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            samples = data if isinstance(data, list) else data.get("samples", data)
        except (json.JSONDecodeError, OSError):
            continue
        for s in samples:
            out.append((set_name, str(s.get("tool_name", "")), str(s.get("arguments", {}))))
    return out


def _embedder() -> HighAccuracy1024EmbeddingFunction:
    return HighAccuracy1024EmbeddingFunction()


def validate_sample(sample: dict) -> str | None:
    """Return an error message when the sample schema is invalid, else None."""
    if not isinstance(sample, dict):
        return "sample must be an object"
    if sample.get("label") not in _VALID_LABELS:
        return f"label must be one of {_VALID_LABELS}"
    if not isinstance(sample.get("tool_name"), str) or not sample["tool_name"].strip():
        return "tool_name must be a non-empty string"
    if not isinstance(sample.get("arguments"), dict) or not sample["arguments"]:
        return "arguments must be a non-empty object"
    return None


def contamination_reason(sample: dict, threshold: float = SIMILARITY_CAP) -> str | None:
    """Return a rejection reason when *sample* duplicates or too closely
    resembles a reference-set sample (embedding similarity >= threshold)."""
    text = str(sample.get("arguments", {}))
    embedder = _embedder()
    query = embedder.embed(text)
    for set_name, _tool, ref_text in _reference_texts():
        sim = cosine_similarity(query, embedder.embed(ref_text))
        if sim >= threshold:
            return f"too similar to an existing {set_name}-set sample (sim={sim:.2f})"
    return None


def submit_sample(sample: dict, source: str = "community") -> dict:
    """Validate + guard + store one community submission.

    Raises SubmissionError with a reason when rejected.
    """
    err = validate_sample(sample)
    if err:
        raise SubmissionError(err)

    # Exact-duplicate check against previously accepted submissions.
    key = (str(sample["tool_name"]), json.dumps(sample["arguments"], sort_keys=True))
    for existing in _load_json(SUBMISSIONS_PATH, []):
        existing_key = (
            str(existing.get("tool_name", "")),
            json.dumps(existing.get("arguments", {}), sort_keys=True),
        )
        if existing_key == key:
            raise SubmissionError("exact duplicate of an already-accepted submission")

    reason = contamination_reason(sample)
    if reason:
        raise SubmissionError(reason)

    record = {
        "id": str(uuid.uuid4()),
        "tool_name": sample["tool_name"],
        "arguments": sample["arguments"],
        "label": sample["label"],
        "class": sample.get("class", "submission"),
        "note": sample.get("note", ""),
        "source": source,
        "submitted_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    submissions = _load_json(SUBMISSIONS_PATH, [])
    submissions.append(record)
    _save_json(SUBMISSIONS_PATH, submissions)
    return record


def accepted_samples() -> list[dict]:
    return _load_json(SUBMISSIONS_PATH, [])


def record_entry(
    provider: str,
    recall80: float,
    recall50: float,
    fpr50: float,
    set_name: str,
    scored_samples: int,
    ece: float | None = None,
    threshold: int | None = None,
    source_url: str = "",
    extra: dict | None = None,
) -> dict:
    """Insert (or replace) one leaderboard entry and re-rank."""
    entries = _load_json(LEADERBOARD_PATH, [])
    entry = {
        "provider": provider,
        "set_name": set_name,
        "recall@80": round(recall80, 4),
        "recall@50": round(recall50, 4),
        "fpr@50": round(fpr50, 4),
        "ece": round(ece, 4) if ece is not None else None,
        "threshold": threshold,
        "scored_samples": scored_samples,
        "source_url": source_url,
        "recorded_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        **(extra or {}),
    }
    entries = [e for e in entries if e.get("provider") != provider or e.get("set_name") != set_name]
    entries.append(entry)
    _save_json(LEADERBOARD_PATH, entries)
    return entry


def leaderboard(set_name: str | None = None) -> list[dict]:
    """Ranked entries: recall@80 desc, then fpr@50 asc."""
    entries = _load_json(LEADERBOARD_PATH, [])
    if set_name:
        entries = [e for e in entries if e.get("set_name") == set_name]
    return sorted(
        entries,
        key=lambda e: (e.get("recall@80") or 0.0, -(e.get("fpr@50") or 1.0)),
        reverse=True,
    )
