# ARTSA 14-Day Evaluation Kit

> Phase 5.1 — a self-serve "with/without ARTSA" proof a prospect can run in
> seconds on a laptop. No cloud, no DB, no API keys.

## Run it

```bash
# one-liner (recommended): real semantic layer
cd backend
ARTSA_EMBEDDING_MODEL=local-bge-multilingual PYTHONPATH=. \
    python scripts/eval_kit.py --samples 200

# or via Docker (reproducible anywhere):
docker compose --profile eval run --rm eval-kit
```

## What it does

`scripts/eval_kit.py` generates a **deterministic** mix of realistic agent work —
benign ops (kubectl get, git pull, db reads, authed API calls, terraform plan)
and attacks (prompt injection, jailbreak, exfiltration, reverse shell,
credential theft, destructive IaC, SQL injection, metadata/SSRF) — runs it
through the containment engine, and reports:

| Metric | Meaning |
|---|---|
| attacks BLOCKED (≥80) | stopped before they reach the agent |
| attacks FLAGGED (≥50) | surfaced for human review |
| attacks let through | missed — should be 0 on this curated mix |
| benign ops allowed | normal work not interrupted |
| benign ops wrongly flagged | false positives |

It also prints the **without ARTSA** counterfactual: with no guardrail, 100% of
attacks reach the agent.

## Extending it

- Add events to `_TRAFFIC` in `scripts/eval_kit.py` to model your own workload.
- Use `--seed N` for reproducible runs; `--samples N` to scale.
- Set `ARTSA_EMBEDDING_MODEL=local-bge-multilingual` for the honest semantic
  layer (see `docs/BENCHMARK_METHODOLOGY.md` for the honesty rule).

## After the 14 days

1. Run the real gates: `docs/BENCHMARK_METHODOLOGY.md`.
2. Run the attack-class demos: `make demo CLASS=<class>` (`docs/…`).
3. See the accuracy card: `docs/ACCURACY.md`.
4. Compare against Lakera/Azure with keys: `scripts/external_comparison.py`.
