"""Contamination / self-referentiality audit — Task List Phase 1.5.

Quantifies how much a benchmark's labels are explained by the *signature*
layers alone (rule-based / SQLi / MCP / policy). If the generated benchmark is
caught overwhelmingly by regex signatures while an independent set is not, the
generated set is self-referential — the detector authors wrote both sides.

Also reports the literal pattern overlap between detector sources and the
benchmark's malicious samples (shared substrings), which is the smoking gun.

Usage: ENVIRONMENT=testing PYTHONPATH=. python scripts/contamination_audit.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from src.containment.engine import ContainmentEngine
from src.core.models.events import ToolCallEvent

BENCHMARK = Path(__file__).resolve().parent.parent / "benchmarks" / "labeled_dataset_v3.json"
GOLDEN = Path(__file__).resolve().parent.parent / "benchmarks" / "golden_set.json"

# Detectors excluded for the "signature-only" engine: the ones that can
# generalize (semantic embeddings, statistical, trajectory, goal-drift,
# tool-output, canary). Keep only deterministic pattern detectors.
_SIGNATURE_ONLY_DISABLED = [
    "SemanticDetector",
    "StatisticalDetector",
    "TrajectoryDetector",
    "GoalDriftDetector",
    "ToolOutputScanner",
    "CanaryTokenDetector",
]


def _signature_recall(samples: list[dict]) -> tuple[int, int]:
    engine = ContainmentEngine(disabled_detectors=_SIGNATURE_ONLY_DISABLED)
    caught = 0
    for s in samples:
        if s.get("label") != "malicious":
            continue
        event = ToolCallEvent(
            session_id=__import__("uuid").uuid4(),
            agent_id="audit",
            tool_name=s["tool_name"],
            arguments=s["arguments"],
        )
        risk, _, _ = engine.evaluate_event(event)
        if risk.overall_score >= 80:
            caught += 1
    total = sum(1 for s in samples if s.get("label") == "malicious")
    return caught, total


def _shared_substrings(samples: list[dict], min_len: int = 6) -> list[str]:
    """Literal substrings of benchmark args that also appear in detector regexes."""
    import re

    from src.containment.detectors.policy import load_policy_rules
    from src.containment.detectors.prompt_injection import INJECTION_PATTERNS
    from src.containment.detectors.rule_based import RuleBasedDetector
    from src.containment.detectors.sql_injection import SQL_PATTERNS

    regex_sources: list[str] = []
    for pattern, *_rest in RuleBasedDetector.DEFAULT_PATTERNS:
        regex_sources.append(pattern)
    for pattern, *_rest in SQL_PATTERNS:
        regex_sources.append(pattern)
    for pattern, *_rest in INJECTION_PATTERNS:
        regex_sources.append(pattern)
    for rule in load_policy_rules():
        regex_sources.append(rule.pattern)

    # Extract literal (non-meta) tokens from the regexes.
    literal_tokens: set[str] = set()
    for rx in regex_sources:
        for m in re.findall(r"[A-Za-z0-9_.\-\/ ]{6,}", rx):
            literal_tokens.add(m.strip().lower())

    overlaps: set[str] = set()
    for s in samples:
        if s.get("label") != "malicious":
            continue
        text = str(s.get("arguments", {})).lower()
        for tok in literal_tokens:
            if tok in text and len(tok) >= 6:
                overlaps.add(tok)
    return sorted(overlaps, key=len, reverse=True)[:20]


def main() -> int:
    bench = json.loads(BENCHMARK.read_text(encoding="utf-8"))
    bench_samples = bench if isinstance(bench, list) else bench.get("samples", bench)
    golden = json.loads(GOLDEN.read_text(encoding="utf-8"))
    golden_samples = golden["samples"]

    b_caught, b_total = _signature_recall(bench_samples)
    g_caught, g_total = _signature_recall(golden_samples)

    print("Signature-only recall@80 (rule/SQLi/MCP/policy, no semantic/statistical):")
    print(f"  generated benchmark : {b_caught}/{b_total} = {b_caught/b_total:.3f}")
    print(f"  independent golden  : {g_caught}/{g_total} = {g_caught/g_total:.3f}")
    ratio = (b_caught / b_total) / (g_caught / g_total) if g_caught else float("inf")
    print(f"  self-referentiality ratio (benchmark/golden): {ratio:.2f}x "
          f"(>1 = the generated set is more regex-friendly)")

    overlaps = _shared_substrings(bench_samples)
    print("\nLiteral tokens shared between detector regexes and generated-benchmark args:")
    if overlaps:
        for tok in overlaps:
            print(f"  - {tok!r}")
    else:
        print("  (none found)")

    verdict = "HIGH" if ratio >= 2.0 else "MODERATE" if ratio > 1.2 else "LOW"
    print(f"\nSelf-referentiality verdict: {verdict}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
