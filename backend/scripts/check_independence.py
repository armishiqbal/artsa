"""Independence guard — Task List Phase 1.1.

For every sample in a candidate independent set, assert two properties:

  1. NON-DUPLICATION — no embedding similarity >= 0.85 to any sample in the
     generated benchmark (it must not be the same attack rephrased).
  2. GENERALIZATION VALUE — report the share of samples that are INVISIBLE to
     the signature (regex) layers. Samples caught by a literal regex are
     "regex-visible" — useful but not generalization tests.

This is the discipline that keeps the independent set independent: if a
sample duplicates the generator or is trivially regex-caught, it does not
belong in a set meant to prove generalization.

Usage: ENVIRONMENT=testing PYTHONPATH=. python scripts/check_independence.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from src.data.embedding_manager import HighAccuracy1024EmbeddingFunction, cosine_similarity

BENCHMARK = Path(__file__).resolve().parent.parent / "benchmarks" / "labeled_dataset_v3.json"
INDEPENDENT = Path(__file__).resolve().parent.parent / "benchmarks" / "independent_set.json"

SIMILARITY_CAP = 0.85


def _samples(path: Path) -> list[dict]:
    data = json.loads(path.read_text(encoding="utf-8"))
    return data if isinstance(data, list) else data.get("samples", data)


def _text(s: dict) -> str:
    return str(s.get("arguments", {}))


def main() -> int:
    bench = _samples(BENCHMARK)
    indep = _samples(INDEPENDENT)

    embedder = HighAccuracy1024EmbeddingFunction()
    bench_vecs = [embedder.embed(_text(s)) for s in bench]

    duplicates: list[str] = []
    for s in indep:
        vec = embedder.embed(_text(s))
        sims = [cosine_similarity(vec, b) for b in bench_vecs]
        worst = max(sims) if sims else 0.0
        if worst >= SIMILARITY_CAP:
            duplicates.append(f"{s['tool_name']} {_text(s)[:60]} (sim {worst:.2f})")

    # Regex-visible share: does any signature detector fire on the sample?
    from src.containment.engine import ContainmentEngine
    from src.core.models.events import ToolCallEvent

    engine = ContainmentEngine(disabled_detectors=[
        "SemanticDetector", "StatisticalDetector", "TrajectoryDetector",
        "GoalDriftDetector", "ToolOutputScanner", "CanaryTokenDetector",
    ])
    import uuid

    regex_visible = 0
    for s in indep:
        if s.get("label") != "malicious":
            continue
        event = ToolCallEvent(session_id=uuid.uuid4(), agent_id="indep",
                              tool_name=s["tool_name"], arguments=s["arguments"])
        risk, _, _ = engine.evaluate_event(event)
        if risk.overall_score >= 50:
            regex_visible += 1
    n_mal = sum(1 for s in indep if s.get("label") == "malicious")

    print(f"Independent set: {len(indep)} samples")
    print(f"  duplicates vs generated benchmark (sim >= {SIMILARITY_CAP}): {len(duplicates)}")
    for d in duplicates[:5]:
        print(f"    - {d}")
    print(f"  regex-visible malicious: {regex_visible}/{n_mal} "
          f"({regex_visible/n_mal:.2f} — the rest are generalization-only samples)")

    if duplicates:
        print("\nINDEPENDENCE CHECK FAILED: duplicates found — remove them.")
        return 1
    print("\nIndependence check passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
