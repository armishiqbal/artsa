# ARTSA Benchmark Methodology (Public Harness)

> Task List Phase 3.1 — reproducible by third parties. Every number in
> `docs/ACCURACY.md` and the task list comes from these gates, run exactly as
> documented below.

## Reproducing the numbers

Prerequisites: Python 3.11+, `pip install -e ".[dev]"`, and (for the honest
semantic numbers) the local ONNX embedding model downloaded on first run:

```bash
cd backend
export PYTHONPATH=.
export ENVIRONMENT=testing
export ARTSA_EMBEDDING_MODEL=local-bge-multilingual   # real semantic layer
```

Run each gate:

```bash
python scripts/golden_gate.py            # golden set: recall/FPR/ECE/threshold
python scripts/golden_gate.py --json     # machine-readable results
python scripts/canary_gate.py            # held-out release gate (labels hashed)
python scripts/independent_gate.py       # 1,084-sample generalization set
python scripts/independent_gate.py --json
python scripts/redteam_gate.py           # mutation corpus + semantic catch rate
python scripts/accuracy_card.py          # regenerates docs/ACCURACY.md
python scripts/check_independence.py     # independent-set non-duplication guard
python scripts/contamination_audit.py    # generator self-referentiality audit
```

**Honesty rule:** `ARTSA_EMBEDDING_MODEL=hash-1024` (the `ENVIRONMENT=testing`
default) disables the embedding detector — numbers produced that way do NOT
represent the semantic layer. Every published number uses
`local-bge-multilingual` unless stated otherwise.

## Sets

| Set | File | Size | Labels | Purpose |
|---|---|---|---|---|
| Golden | `benchmarks/golden_set.json` | 33 mal / 32 safe / 5 review | plain | familiar-shape regression + calibration |
| Canary | `benchmarks/canary_set.json` | 16 mal / 8 safe | **SHA-256 hashed** | held-out release gate — labels unreadable in-repo, tuning against it is impossible |
| Independent | `benchmarks/independent_set.json` | 632 mal / 452 safe | plain | 1,000+ hand-curated generalization set; independence guard enforces non-duplication vs the generator |
| Generated | `benchmarks/labeled_dataset_v3.json` | 552 | plain | generator output used ONLY for contamination/independence checks, never for scoring claims |

## Metrics

- **recall@80** — malicious calls reaching the KILL band (score ≥ 80).
- **recall@50** — malicious calls at least flagged (≥ 50).
- **FPR@50** — benign calls wrongly flagged at the review band (≥ 50).
- **ECE** — 10-bin expected calibration error over all scored samples
  (`src/benchmark/calibration.py`).
- **Recommended threshold** — cost-aware operating point minimizing
  `fp_cost·FPR·n_safe + fn_cost·(1−recall)·n_mal` (FP 1 / FN 10), tie-broken to
  the highest equal-cost threshold.
- **Regex-invisible semantic catch rate** — attacks the signature layers do NOT
  catch (no rule/pattern fired) that the embedding layer still catches. The
  single most defensible generalization number.
- **Independence** — max embedding similarity of every independent-set sample
  vs the generated benchmark must be < 0.85 (real embeddings).
- **Contamination audit** — signature-only recall on generated vs golden;
  ratio < 1.25× → low self-referentiality.

## Discipline

- The canary's labels are stored as SHA-256 hashes; the gate decodes and
  reports AGGREGATES ONLY. The tuning loop is closed before a release re-run.
- The independent set has no floor — it is evidence, not a gate. A recall floor
  lands once the documented Phase-2 follow-up (destructive-IaC, credential
  paths, deeper obfuscation) closes the measured gap.
- LLM attacker variants (Phase 2.1b) are opt-in and never mixed into the
  published golden/canary numbers.

## Third-party comparison (Phase 3.2)

`backend/scripts/external_comparison.py` runs the independent set through
ARTSA and, when provider keys are configured, through Lakera Guard and
Microsoft Azure AI Content Safety on the same samples, emitting a comparison
table (`docs/COMPARISON.md`). See its docstring for the key environment
variables. Without keys it reports ARTSA's own numbers and the methodology —
the table is only as real as the keys you configure.
