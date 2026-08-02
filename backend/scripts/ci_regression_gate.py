#!/usr/bin/env python3
"""CI regression gate — exit non-zero when containment benchmark SLOs fail."""

from __future__ import annotations

import sys

# Floors aligned with observatory regression gates (see observatory._regression_status)
RECALL_FLOOR_AT_80 = 0.40
FPR_CEILING_AT_50 = 0.15
LATENCY_CEILING_MS = 50.0
BASELINE_RECALL_FLOOR = 0.40


def main() -> int:
    from src.benchmark.ablation import AblationHarness
    from src.benchmark.harness import BenchmarkHarness

    failures: list[str] = []

    harness = BenchmarkHarness()
    report = harness.run()
    t80 = next(t for t in report.thresholds if t.threshold == 80.0)
    t50 = next(t for t in report.thresholds if t.threshold == 50.0)

    print(f"Benchmark dataset: {harness.dataset_version} ({report.total_samples} samples)")
    print(f"  recall@80={t80.recall:.4f}  precision@80={t80.precision:.4f}")
    print(f"  fpr@50={t50.fpr:.4f}  avg_latency={report.avg_latency_ms:.2f}ms")

    if t80.recall < RECALL_FLOOR_AT_80:
        failures.append(f"recall@80 {t80.recall:.4f} < floor {RECALL_FLOOR_AT_80}")
    if t50.fpr > FPR_CEILING_AT_50:
        failures.append(f"fpr@50 {t50.fpr:.4f} > ceiling {FPR_CEILING_AT_50}")
    if report.avg_latency_ms > LATENCY_CEILING_MS:
        failures.append(f"avg_latency {report.avg_latency_ms:.2f}ms > ceiling {LATENCY_CEILING_MS}ms")

    ablation = AblationHarness()
    ablation_report = ablation.run_ablation()
    print(f"  ablation baseline recall@80={ablation_report.baseline_recall:.4f}")

    if ablation_report.baseline_recall < BASELINE_RECALL_FLOOR:
        failures.append(
            f"ablation baseline recall {ablation_report.baseline_recall:.4f} < floor {BASELINE_RECALL_FLOOR}"
        )

    if failures:
        print("\nREGRESSION GATE FAILED:")
        for item in failures:
            print(f"  - {item}")
        return 1

    print("\nRegression gate passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
