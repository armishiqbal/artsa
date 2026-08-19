"""Score calibration metrics — Task List Phase 1.3/1.4.

A guardrail is only trustworthy if its scores mean what they say. This module
provides:

  * Expected Calibration Error (ECE): does "score 80" actually mean ~80% of
    those calls are malicious? Bucketed |accuracy - confidence|, weighted.
  * Reliability table: per-bin mean score vs observed malicious fraction.
  * Operating-point curve: recall / FPR / cost at every threshold.
  * Cost-aware optimal threshold: the deployment-specific operating point
    given the cost of a false kill vs a missed attack.

The same helpers feed the accuracy card (Phase 1.6).
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class ReliabilityRow:
    bin_index: int
    bin_range: tuple[float, float]
    count: int
    mean_score: float
    fraction_malicious: float
    calibration_gap: float


@dataclass
class CalibrationReport:
    ece: float
    bins: int
    reliability: list[ReliabilityRow] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "ece": round(self.ece, 4),
            "bins": self.bins,
            "reliability": [
                {
                    "bin": r.bin_index,
                    "range": [r.bin_range[0], r.bin_range[1]],
                    "count": r.count,
                    "mean_score": round(r.mean_score, 2),
                    "fraction_malicious": round(r.fraction_malicious, 4),
                    "gap": round(r.calibration_gap, 4),
                }
                for r in self.reliability
            ],
        }


@dataclass
class OperatingPoint:
    threshold: int
    recall: float
    fpr: float
    true_positives: int
    false_positives: int


@dataclass
class ThresholdRecommendation:
    threshold: int
    expected_cost: float
    recall: float
    fpr: float
    fp_cost: float
    fn_cost: float


def expected_calibration_error(
    pairs: list[tuple[float, bool]], bins: int = 10
) -> CalibrationReport:
    """ECE + reliability table.

    ``pairs`` is ``[(score 0..100, is_malicious_bool), ...]``.
    """
    if not pairs:
        return CalibrationReport(ece=0.0, bins=bins)

    total = len(pairs)
    ece = 0.0
    reliability: list[ReliabilityRow] = []

    for b in range(bins):
        lo = (b / bins) * 100.0
        hi = ((b + 1) / bins) * 100.0
        bucket = [
            (s, l)
            for s, l in pairs
            if (lo <= s < hi) or (b == bins - 1 and s == 100.0)
        ]
        if not bucket:
            continue
        mean_score = sum(s for s, _ in bucket) / len(bucket)
        fraction_mal = sum(1 for _, l in bucket if l) / len(bucket)
        gap = abs((mean_score / 100.0) - fraction_mal)
        ece += (len(bucket) / total) * gap
        reliability.append(
            ReliabilityRow(
                bin_index=b,
                bin_range=(round(lo, 1), round(hi, 1)),
                count=len(bucket),
                mean_score=mean_score,
                fraction_malicious=fraction_mal,
                calibration_gap=gap,
            )
        )

    return CalibrationReport(ece=ece, bins=bins, reliability=reliability)


def operating_points(
    pairs: list[tuple[float, bool]], step: int = 5
) -> list[OperatingPoint]:
    """Recall + FPR at every threshold from 0..100."""
    mal = sum(1 for _, l in pairs if l)
    safe = sum(1 for _, l in pairs if not l)
    points: list[OperatingPoint] = []
    for t in range(0, 101, step):
        tp = sum(1 for s, l in pairs if l and s >= t)
        fp = sum(1 for s, l in pairs if not l and s >= t)
        points.append(
            OperatingPoint(
                threshold=t,
                recall=(tp / mal) if mal else 0.0,
                fpr=(fp / safe) if safe else 0.0,
                true_positives=tp,
                false_positives=fp,
            )
        )
    return points


def optimal_threshold(
    pairs: list[tuple[float, bool]],
    fp_cost: float = 1.0,
    fn_cost: float = 10.0,
    step: int = 5,
) -> ThresholdRecommendation:
    """Threshold that minimizes expected cost:
    fp_cost * FPR * n_safe + fn_cost * (1 - recall) * n_mal.
    """
    mal = sum(1 for _, l in pairs if l)
    safe = sum(1 for _, l in pairs if not l)
    best: tuple[float, OperatingPoint] | None = None
    for p in operating_points(pairs, step=step):
        cost = fp_cost * p.fpr * safe + fn_cost * (1.0 - p.recall) * mal
        if best is None or cost < best[0]:
            best = (cost, p)
    assert best is not None
    cost, point = best
    return ThresholdRecommendation(
        threshold=point.threshold,
        expected_cost=cost,
        recall=point.recall,
        fpr=point.fpr,
        fp_cost=fp_cost,
        fn_cost=fn_cost,
    )
