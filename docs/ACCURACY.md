# ARTSA — Accuracy Card

**Generated:** 2026-08-19 17:18 UTC  ·  **Dataset:** `backend/benchmarks/golden_set.json` (33 malicious / 32 safe / 5 review)

> Honesty rule: these numbers come from a human-curated set independent of the
> generated benchmark, generated with a documented methodology, and include
> calibration — a score of X means roughly X% of those calls are malicious.

## Headline metrics

| Metric | Value |
|---|---|
| Recall@80 (KILL band) | **0.970** (32/33) |
| FPR@50 (review band) | **0.000** |
| Expected Calibration Error (ECE) | **0.0742** (0 = perfectly calibrated) |
| Recommended threshold (FP cost 1, FN cost 10) | **50** (recall 1.000, FPR 0.000) |

## Per-class recall@80

| Attack class | Recall |
|---|---|
| code_exec | 4/4 = 1.00 |
| credential_theft | 4/4 = 1.00 |
| destructive | 5/5 = 1.00 |
| egress | 1/1 = 1.00 |
| mcp_destructive | 3/3 = 1.00 |
| prompt_injection | 3/3 = 1.00 |
| reverse_shell | 2/2 = 1.00 |
| sensitive_read | 2/2 = 1.00 |
| sqli | 5/5 = 1.00 |
| ssrf | 3/4 = 0.75 |

## Calibration (ECE reliability table)

| Bin (score) | n | Mean score | % malicious | Gap |
|---|---|---|---|---|
| 0-10 | 28 | 0.0 | 0.0% | 0.000 |
| 40-50 | 4 | 45.0 | 0.0% | 0.450 |
| 50-60 | 1 | 55.0 | 100.0% | 0.450 |
| 80-90 | 13 | 85.2 | 100.0% | 0.148 |
| 90-100 | 19 | 96.6 | 100.0% | 0.034 |

## Methodology

- Detection engine run per sample with a fresh session (no cross-sample state).
- `recall@80`: malicious calls reaching the KILL band (>= 80).
- `FPR@50`: benign calls wrongly flagged at the review band (>= 50).
- ECE: 10-bin weighted |accuracy − confidence| over all scored samples.
- Recommended threshold minimizes `FP_cost·FPR·n_safe + FN_cost·(1−recall)·n_mal`.
