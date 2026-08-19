"""Phase 1.3/1.4 tests — calibration, operating points, cost-aware threshold."""

import itertools

from src.benchmark.calibration import (
    expected_calibration_error,
    operating_points,
    optimal_threshold,
)


def test_perfectly_calibrated_has_zero_ece():
    # Within each score, the malicious fraction equals the score/100 -> ECE ~ 0.
    pairs = [(50.0, True)] * 5 + [(50.0, False)] * 5 + \
            [(90.0, True)] * 9 + [(90.0, False)] * 1 + \
            [(30.0, True)] * 3 + [(30.0, False)] * 7
    report = expected_calibration_error(pairs, bins=10)
    assert report.ece < 0.05


def test_miscalibrated_has_positive_ece():
    # Low scores that are actually malicious -> badly miscalibrated.
    pairs = [(10.0, True), (20.0, True), (30.0, True), (90.0, False), (95.0, False)]
    report = expected_calibration_error(pairs, bins=10)
    assert report.ece > 0.1
    assert report.reliability  # at least one populated bin


def test_operating_points_monotonic():
    pairs = [(s, s >= 80) for s in range(101)]  # perfect threshold at 80
    points = operating_points(pairs, step=5)
    recalls = [p.recall for p in points]
    fprs = [p.fpr for p in points]
    # Recall and FPR are non-increasing as the threshold rises.
    assert all(a >= b for a, b in itertools.pairwise(recalls))
    assert all(a >= b for a, b in itertools.pairwise(fprs))


def test_optimal_threshold_high_cost_of_misses():
    # Missing an attack costs 10x a false kill -> the optimum favors recall.
    pairs = [(s, s >= 80) for s in range(101)]
    rec = optimal_threshold(pairs, fp_cost=1.0, fn_cost=10.0)
    assert rec.threshold <= 80
    assert rec.recall >= 0.95  # security-biased: catch nearly everything


def test_optimal_threshold_low_cost_of_misses():
    # When a false kill is expensive relative to a miss, prefer low FPR.
    pairs = [(s, s >= 80) for s in range(101)]
    rec = optimal_threshold(pairs, fp_cost=10.0, fn_cost=1.0)
    assert rec.fpr < 0.2


def test_calibration_empty_set():
    report = expected_calibration_error([])
    assert report.ece == 0.0
