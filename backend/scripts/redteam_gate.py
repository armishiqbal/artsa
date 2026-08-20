"""Agentic red-team gate — Task List Phase 2.4.

Generates a mutation corpus from the golden set's malicious phrases, measures
mutation diversity, runs it through the containment engine, and reports:

  * corpus diversity (are the mutations actually spread out?)
  * recall over the corpus (does the guardrail generalize to variants?)
  * per-encoding recall (base64/url/homoglyph/…)
  * detector attribution (which layer fires most?)
  * REGEX-INVISIBLE SEMANTIC CATCH RATE — attacks that no signature layer sees
    but the embedding layer still catches. The single most defensible number:
    it proves the semantic detector generalizes instead of memorizing regexes.

No hard recall floor by default (it's an evidence generator); pass
``--fail-below <recall>`` to make it a gate.

Honest measurement (Phase-2 normalization, 2026-08-20): run with the REAL
embedding model, otherwise the semantic layer is dead and the regex-invisible
catch rate reads ~0:

    ARTSA_EMBEDDING_MODEL=local-bge-multilingual ENVIRONMENT=testing \
        PYTHONPATH=. python scripts/redteam_gate.py

Measured 2026-08-20 (incl. Phase-2.5 multilingual stage): regex-invisible
semantic catch rate 0.792 (was 0.031 pre-normalization); corpus recall 0.831
over 1,175 variants; multilingual encoding recall 0.787, bilingual_mix 1.000.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from src.containment.detectors.semantic import MALICIOUS_PHRASES
from src.redteam.diversity import diversity_is_healthy, mutation_diversity
from src.redteam.mutator import RedTeamMutator
from src.redteam.runner import evaluate_attacks

GOLDEN_SET = Path(__file__).resolve().parent.parent / "benchmarks" / "golden_set.json"


def _base_phrases() -> list[str]:
    """Seed phrases: the golden set's malicious prompt-injection payloads plus
    the semantic reference library — real attacks, not a generated set."""
    phrases: list[str] = list(MALICIOUS_PHRASES)
    try:
        data = json.loads(GOLDEN_SET.read_text(encoding="utf-8"))
        for s in data.get("samples", []):
            if s.get("label") != "malicious":
                continue
            for key in ("payload", "command", "sql", "q", "body"):
                val = s.get("arguments", {}).get(key)
                if isinstance(val, str) and len(val) > 12:
                    phrases.append(val)
                    break
    except FileNotFoundError:
        pass
    # De-dup, keep stable order.
    seen: set[str] = set()
    ordered: list[str] = []
    for p in phrases:
        if p not in seen:
            seen.add(p)
            ordered.append(p)
    return ordered


def main() -> int:
    parser = argparse.ArgumentParser(description="ARTSA red-team mutation gate")
    parser.add_argument(
        "--fail-below",
        type=float,
        default=None,
        help="exit 1 if overall corpus recall is below this",
    )
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--json", action="store_true", help="print report as JSON")
    args = parser.parse_args()

    bases = _base_phrases()
    mutator = RedTeamMutator(seed=args.seed)
    corpus = mutator.generate_corpus(bases)

    diversity = mutation_diversity([c["variant"] for c in corpus])
    report = evaluate_attacks(corpus)

    if args.json:
        print(
            json.dumps(
                {
                    "diversity": diversity.to_dict(),
                    "report": report.to_dict(),
                    "seed_phrases": len(bases),
                },
                indent=2,
            )
        )
        return 0

    print(f"Seed phrases: {len(bases)}  |  Corpus: {report.corpus_size} variants")
    print(
        f"Diversity : mean_pairwise_distance={diversity.mean_pairwise_distance:.3f} "
        f"clusters={diversity.distinct_clusters} "
        f"healthy={diversity_is_healthy(diversity)}"
    )
    print(f"Recall    : {report.caught}/{report.corpus_size} = {report.recall:.3f}")
    print("By encoding:")
    for enc, stats in sorted(report.by_encoding.items()):
        print(f"  {enc:<20} {stats['caught']:>3}/{stats['total']:<3} = {stats['recall']:.3f}")
    print("Detector fires:")
    for det, count in report.detector_fires.items():
        print(f"  {det:<28} {count}")
    print(
        f"\nREGEX-INVISIBLE SEMANTIC CATCH RATE: "
        f"{report.regex_invisible_semantic_caught}/{report.regex_invisible_total} "
        f"= {report.regex_invisible_semantic_catch_rate:.3f}"
    )

    if args.fail_below is not None and report.recall < args.fail_below:
        print(f"\nRED-TEAM GATE FAILED: recall {report.recall:.3f} < {args.fail_below}")
        return 1
    print("\nRed-team gate complete.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
