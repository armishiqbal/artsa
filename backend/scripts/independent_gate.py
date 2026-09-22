"""Independent-set evaluation gate — Task List Phase 1.1.

Scores the curated independent set (1,100+ hand-curated samples, v2.1) and
reports recall/FPR WITHOUT a floor: this is evidence about generalization, and
the honest number is the point. The recall floor appears once the Phase-2
obfuscation-normalization work closes the gap the canary/independent sets have
exposed.

Honest measurement: run with the REAL embedding model, otherwise the semantic
layer is dead:

    ARTSA_EMBEDDING_MODEL=local-bge-multilingual ENVIRONMENT=testing \
        PYTHONPATH=. python scripts/independent_gate.py
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
import time
import uuid
from pathlib import Path

from src.containment.engine import ContainmentEngine
from src.core.config import settings
from src.core.models.events import ToolCallEvent
from src.data.embedding_manager import EmbeddingUnavailable

INDEPENDENT = Path(__file__).resolve().parent.parent / "benchmarks" / "independent_set.json"


def main() -> int:
    parser = argparse.ArgumentParser(description="ARTSA independent-set evaluation gate")
    parser.add_argument(
        "--json",
        action="store_true",
        help="print machine-readable results (reproducible public-scoring output)",
    )
    parser.add_argument(
        "--dataset",
        type=Path,
        default=INDEPENDENT,
        help="curated dataset to evaluate (defaults to the independent set)",
    )
    args = parser.parse_args()

    dataset_bytes = args.dataset.read_bytes()
    data = json.loads(dataset_bytes)
    samples = data["samples"]
    metadata = data.get("_meta", {})
    dataset_sha256 = hashlib.sha256(dataset_bytes).hexdigest()
    embedding_model = settings.resolve_embedding_model()
    semantic_mode = "disabled" if embedding_model == "hash-1024" else "configured"

    # A real model can fail during reference-vector initialization (for example
    # when a staging node has no model files). Keep the gate's result explicit
    # instead of silently scoring a weakened fallback.
    engine_init_error: str | None = None
    try:
        engine = ContainmentEngine()
    except EmbeddingUnavailable as exc:
        engine = None
        engine_init_error = str(exc)
        semantic_mode = "unavailable"

    mal_scores: list[tuple[str, float]] = []
    safe_scores: list[float] = []
    latencies_ms: list[float] = []
    unavailable_samples = 0
    for s in samples:
        event = ToolCallEvent(
            session_id=uuid.uuid4(),
            agent_id="indep",
            tool_name=s["tool_name"],
            arguments=s["arguments"],
        )
        started = time.perf_counter()
        if engine is None:
            unavailable_samples += 1
            latencies_ms.append((time.perf_counter() - started) * 1000)
            continue
        try:
            risk, _, security_events = engine.evaluate_event(event)
        except EmbeddingUnavailable:
            unavailable_samples += 1
            latencies_ms.append((time.perf_counter() - started) * 1000)
            semantic_mode = "unavailable"
            continue
        latencies_ms.append((time.perf_counter() - started) * 1000)
        if any(
            event.detector == "SemanticDetector"
            and event.evidence.get("reason") == "embedding_unavailable"
            for event in security_events
        ):
            unavailable_samples += 1
            semantic_mode = "unavailable"
            # Fail-closed evidence proves the backend was unavailable, not that
            # the sample was detected. Exclude it from recall/FPR denominators.
            continue
        if s["label"] == "malicious":
            mal_scores.append((s.get("class", "?"), risk.overall_score))
        else:
            safe_scores.append(risk.overall_score)

    n_mal = len(mal_scores)
    n_safe = len(safe_scores)
    recall80 = sum(1 for _, sc in mal_scores if sc >= 80) / n_mal if n_mal else None
    recall50 = sum(1 for _, sc in mal_scores if sc >= 50) / n_mal if n_mal else None
    fpr50 = sum(1 for sc in safe_scores if sc >= 50) / n_safe if n_safe else None
    p99_latency_ms = (
        sorted(latencies_ms)[
            min(len(latencies_ms) - 1, max(0, math.ceil(len(latencies_ms) * 0.99) - 1))
        ]
        if latencies_ms
        else None
    )
    unavailable_rate = unavailable_samples / len(samples) if samples else 0.0

    print(
        f"Evaluation set: {n_mal} malicious / {n_safe} safe "
        f"({len(samples)} total, curated, generalization-focused)"
    )
    print(
        "  provenance  = "
        f"{metadata.get('name', 'unknown')} v{metadata.get('version', 'unknown')}; "
        f"curated {metadata.get('curated', 'unknown')}; sha256 {dataset_sha256}"
    )
    print(f"  semantic    = {semantic_mode} ({embedding_model})")
    print(
        f"  unavailable = {unavailable_samples}/{len(samples)} "
        f"({unavailable_rate:.3f})"
    )
    print(f"  p99 latency = {p99_latency_ms:.3f} ms" if p99_latency_ms is not None else "  p99 latency = N/A")
    print(
        f"  recall@80 = {recall80:.3f}  ({sum(1 for _, sc in mal_scores if sc >= 80)}/{n_mal})"
        if recall80 is not None
        else "  recall@80 = N/A (no available malicious evaluations)"
    )
    print(f"  recall@50 = {recall50:.3f}" if recall50 is not None else "  recall@50 = N/A")
    print(
        f"  FPR@50    = {fpr50:.3f}  ({sum(1 for sc in safe_scores if sc >= 50)}/{n_safe})"
        if fpr50 is not None
        else "  FPR@50    = N/A (no available safe evaluations)"
    )
    print("  per-class recall@80 (worst first):")
    by_class: dict[str, list[float]] = {}
    for cls, sc in mal_scores:
        by_class.setdefault(cls, []).append(sc)
    for cls, scores in sorted(
        by_class.items(), key=lambda kv: sum(1 for s in kv[1] if s >= 80) / len(kv[1])
    ):
        caught = sum(1 for s in scores if s >= 80)
        print(f"    {cls:<24} {caught}/{len(scores)} = {caught / len(scores):.2f}")

    print(
        "\nNo floor applied — this is honest generalization evidence. "
        "Hash-1024 results are rule-layer diagnostics; configured semantic "
        "results are required for semantic generalization claims."
    )

    if args.json:
        # Machine-readable summary for third-party reproduction (Phase 3.1).
        by_class = {}
        for cls, sc in mal_scores:
            by_class.setdefault(cls, []).append(sc)
        print(
            json.dumps(
                {
                    "gate": "independent",
                    "set": str(args.dataset),
                    "dataset_sha256": dataset_sha256,
                    "dataset_provenance": {
                        "name": metadata.get("name"),
                        "version": metadata.get("version"),
                        "curated": metadata.get("curated"),
                        "purpose": metadata.get("purpose"),
                        "batch_sources": metadata.get("batch_sources", []),
                    },
                    "n_malicious": n_mal,
                    "n_safe": n_safe,
                    "n_unavailable": unavailable_samples,
                    "unavailable_rate": round(unavailable_rate, 4),
                    "evaluated_samples": n_mal + n_safe,
                    "recall@80": round(recall80, 4) if recall80 is not None else None,
                    "recall@50": round(recall50, 4) if recall50 is not None else None,
                    "fpr@50": round(fpr50, 4) if fpr50 is not None else None,
                    "p99_latency_ms": round(p99_latency_ms, 3) if p99_latency_ms is not None else None,
                    "per_class_recall_80": {
                        cls: round(sum(1 for s in scores if s >= 80) / len(scores), 4)
                        for cls, scores in by_class.items()
                    },
                    "embedding_model": embedding_model,
                    "semantic_mode": semantic_mode,
                    "engine_init_error": engine_init_error,
                },
                indent=2,
            )
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
