# ARTSA vs External Guardrails — Comparison

**Generated:** 2026-08-20  ·  **Set:** `benchmarks/independent_set.json` (25 malicious / 15 safe samples, first 40)

> Honesty rule: ARTSA scores every sample with its calibrated engine; external
> providers are scored via their public APIs on the IDENTICAL samples. ARTSA
> recall@80/FPR@50 use its calibrated KILL/review bands; external providers
> report their binary 'flagged' decision at any severity. Columns marked n/a
> mean no API key was configured for this run.

| Provider | recall | FPR | notes |
|---|---|---|---|
| ARTSA | recall@80 **0.6** / recall@50 0.76 | fpr@50 0.0 | calibrated bands; embedding `local-bge-multilingual` |
| Lakera Guard | n/a | n/a | binary flagged; 0 samples scored |
| Azure AI Content Safety | n/a | n/a | binary flagged; 0 samples scored |

## Methodology
- Same samples, same order, per provider. ARTSA: `backend/scripts/external_comparison.py` → ContainmentEngine (see `docs/BENCHMARK_METHODOLOGY.md`).
- Lakera: `POST https://api.lakera.ai/v1/prompt_injection` (Bearer key). Azure: `POST /contentsafety/text:analyze` (Ocp-Apim-Subscription-Key); flagged = any category severity ≥ 2.
- External providers are black-boxed: no calibration, binary decisions only.
