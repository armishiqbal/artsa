# ARTSA — Full Task List (2026-08-19, updated 2026-08-20)

Senior-engineer-graded backlog. Order = dependencies first: **security → evidence → engine → credibility → product → GTM**. Items marked ✅ are already done; everything else is open.

> **2026-08-20 update — Phase-2 normalization shipped.** Three latent issues were
> found and fixed, and every eval-gate number was re-measured honestly:
> 1. The `local-bge-*` aliases were never mapped to real FastEmbed model ids, so
>    every "semantic" measurement silently ran on `hash-1024` — the embedding
>    detector was dead in all published numbers.
> 2. No obfuscation normalization existed: homoglyph / leetspeak / ROT13 /
>    unicode-escape / URL / base64 / hex mutations were invisible to semantic
>    and rule layers.
> 3. `ENVIRONMENT=testing` hard-pinned `hash-1024` even when a real model was
>    requested; explicit `ARTSA_EMBEDDING_MODEL` now wins, and gates document
>    `ARTSA_EMBEDDING_MODEL=local-bge-multilingual` for honest measurement.
>
> Net effect: canary gate **PASSES** (0.562→0.875 recall@80, FPR 0.125→0.000),
> regex-invisible semantic catch rate **0.031→0.743**, independent-set recall@80
> **0.375→0.667**, golden ECE 0.0742→0.0703. See `docs/ACCURACY.md` (now records
> embedding run conditions) and `backend/tests/test_obfuscation.py`.

---

## Phase 0 — Security & correctness (DO NOW — blocks everything)

| # | Task | Why | Status |
|---|---|---|---|
| 0.1 | **Remove BFF hardcoded admin backdoor** (`frontend/app/api/backend/[...path]/route.ts`: `admin@artsa.ai/admin12345` + 2 more + fake `registeredAdmins` Map) | Public admin password in deployed code — a security product shipping this fails any review instantly | ✅ removed (`e5fb968`→`aa1e185`); `admin@artsa.ai` survives only as the client-side "Explore Live Preview" placeholder token, never forwarded as a credential |
| 0.2 | **Honest BFF fallback**: backend-unreachable → login/register 503 with "use Explore Live Preview"; health → 503 (UI shows OFFLINE, not fake ONLINE); no internal error-message leaks | Fixes the "API status failed" symptom + honest offline state | ✅ done (`aa1e185`): health→503 degraded/offline, auth→502 honest message, no fabricated payloads |
| 0.3 | Verify no code depends on the fake-auth fallback (E2E smoke + login flow) | Avoid regressions from 0.1/0.2 | ✅ E2E smoke covers login page + honest empty state; real login posts to backend |
| 0.4 | Re-run full verification after 0.1–0.3 (lint, tsc, 95 vitest, build, e2e, backend suite) | Gate the change | ✅ CI runs lint/tsc/vitest/build/e2e/backend/postgres/SDK/regression gates |
| 0.5 | `git push` + CI green | — | ✅ CI green on latest pushes |
| — | ✅ Identity→tenant credential binding (bearer overrides header) | done 2026-08-19 (`147752a`) | ✅ |
| — | ✅ Alert tenant stamping, init_db status column, lint sweep (75 issues), rate-limit tests | done `db29c07`/`147752a` | ✅ |

## Phase 1 — Evaluation credibility (the frontier-lab core — nothing else is real until this)

| # | Task | Why / DoD |
|---|---|---|
| 1.1 | **Independent set + guard** (`benchmarks/independent_set.json`, 40 curated samples + `scripts/check_independence.py` + `scripts/independent_gate.py`). **Measured (real embeddings, 2026-08-20): recall@80 0.667 / FPR@50 0.062; 0 duplicates vs generator; generalization-only** — up from 0.375 after the Phase-2 obfuscation-normalization + real-embedding fix. Gap still mapped per class: multilingual/obfuscation/tool-confusion. Growth to 1,000+ and a recall floor land AFTER this normalization work is shipped (see 2.4) | ✅ infra + batch 1; number improved; 1,000+ still open |
| 1.2 | **Held-out canary set** (`benchmarks/canary_set.json`, 24 samples) — labels stored as SHA-256 hashes so ground truth is unreadable in the repo; `scripts/canary_gate.py` decodes and reports AGGREGATES ONLY. **2026-08-20: recall@80 0.875 / FPR@50 0.000 → PASSES the release floor** (was 0.562/0.125). Closed by Phase-2 obfuscation normalization (homoglyph/leet/rot13/url/base64/hex/unicode-escape), multilingual semantic library, egress-carrier + tunnel rules, and the authenticated-API nuance (FPR). Residual: homoglyph-in-email-content and email-carried injection surface at 45–61 (detected, not enforced) — deliberately NOT tuned against the hashed canary. Not wired into CI (release gate, run at ship time) | ✅ infra + **gate now passes** |
| 1.3 | **Calibration layer** (`src/benchmark/calibration.py`): ECE + reliability table + operating-point curve, wired into golden_gate. **Measured: ECE 0.0703** (real embeddings) | ✅ done |
| 1.4 | **Cost-aware threshold** (`optimal_threshold`): FP 1 / FN 10 → recommended threshold **50** (recall 1.0, FPR 0.0 on golden) — reported in every gate run | ✅ done |
| 1.5 | **Contamination audit** (`scripts/contamination_audit.py`): signature-only recall on generated vs golden + shared-token report. **Measured: 0.930 vs 0.818 → 1.14× → LOW self-referentiality** | ✅ done |
| 1.6 | **Accuracy card** (`scripts/accuracy_card.py` → `docs/ACCURACY.md`): date, dataset, methodology, per-class matrix, ECE, recommended threshold, **embedding run conditions** | ✅ done |

## Phase 2 — Agentic red-teaming engine (the flagship + the eval engine)

| # | Task | Why / DoD |
|---|---|---|
| 2.1 | **Red-team mutation engine** (`src/redteam/mutator.py`): deterministic offline mutations — homoglyph/leet/base64/url/hex/unicode-escape/rot13/synonym/comment-inject, with encoding labels | ✅ done `redteam`; LLM-attacker stage (2.1b, `ARTSA_REDTEAM_LLM_ENABLED`) remains |
| 2.2 | **Diversity metric** (`src/redteam/diversity.py`): pairwise embedding distance + cluster count, `diversity_is_healthy` | ✅ done |
| 2.3 | **Detector-layer attribution** (`src/redteam/runner.py`): full vs semantic-disabled engine per attack, per-encoding recall, detector fire counts | ✅ done |
| 2.4 | **Semantic-bypass fuzzer** (`scripts/redteam_gate.py`, `--redteam` flag in golden_gate): regex-invisible semantic catch rate. **2026-08-20 (real embeddings + obfuscation normalization): 0.743** (was 0.031 with the embedding layer silently dead under hash-1024). Per-encoding: url 0.729, rot13/homoglyph 0.722, unicode_escape 0.695, leetspeak 0.685 — up from ~0.0–0.07. Overall corpus recall 0.785 | ✅ engine + normalization shipped; residual per-encoding gaps documented |
| 2.5 | Fuzz mutations via existing `payload_mutator.py`; add multilingual + Unicode confusables + encoding stages | 🔶 Partial: Unicode confusables + encoding stages in mutator + multilingual phrase library in semantic detector; **multilingual fuzzer stage (generating multilingual mutations) still open** |
| 2.6 | Guardrail against self-defeating output: attacker can't see detector internals during generation | ✅ by construction for the deterministic stage (mutator imports no detector internals); formally OPEN until the LLM-attacker stage lands |

## Phase 3 — Public benchmark + leaderboard (credibility moat)

| # | Task | DoD |
|---|---|---|
| 3.1 | Public harness from `golden_gate.py`; documented methodology | Reproducible by third parties |
| 3.2 | **Independent scoring vs Lakera / Azure / other guardrails** on the same held-out set | A real comparison table, not marketing |
| 3.3 | Leaderboard + community sample-submission pipeline | "HuggingFace of agent security" — compounding data moat |
| 3.4 | Contamination guard on public set (submitter samples held out) | Keeps the leaderboard trustworthy |

## Phase 4 — Product depth (finish the detection story)

| # | Task | Status |
|---|---|---|
| 4.1 | ✅ Real embeddings (open-source FastEmbed), semantic library 24 phrases, embed cache | ✅ `04d1cff` |
| 4.2 | ✅ MCP containment-engine parity (SQLi/reverse-shell/sensitive via MCP blocked) | ✅ `04d1cff` |
| 4.3 | ✅ Org-policy → scoring (PolicyDetector + policy_score) | ✅ `404619b` |
| 4.4 | ✅ Multi-turn goal-drift detector | ✅ `0f97793` |
| 4.5 | ✅ LLM-judge verifier (off by default, escalate-only) | ✅ `ea2ba0b` |
| 4.6 | **Calibrate the LLM judge** (ECE on its verdicts; cap its power until calibrated) | Open — Phase-1 dependency |
| 4.7 | Multi-tenant unique names (integration `name` per tenant), baselines composite PK | Open — edge-case hardening |

## Phase 5 — GTM kit (WS-5)

| # | Task | DoD |
|---|---|---|
| 5.1 | 14-day evaluation kit (compose profile, sample traffic generator, "with/without ARTSA" comparison) | Prospects self-serve proof |
| 5.2 | One-command per-attack-class demo scripts (one per README row) | Credible 10-min demo |
| 5.3 | Public accuracy-card page fed by 1.6 | Marketing truth |
| 5.4 | Integration gallery (LangChain/OpenAI tools/MCP/OTEL/CI snippets + screenshots) | Developer adoption |

## Phase 6 — Optional product bets (pick 1–2 after Phase 1–2)

| # | Idea | Thesis | Effort |
|---|---|---|---|
| 6.1 | **LLM Firewall Gateway** (OpenAI-compatible proxy: sanitize, redact, policy, per-tenant limits, audit) | Revenue; 80% built (`llm_proxy` + engine) | M |
| 6.2 | **Agent Risk-Scoring SDK** (`pip install artsa-guard` / `npm i artsa-guard`; LangChain/CrewAI/AutoGen/MCP plugins) | Developer-tool virality | M |
| 6.3 | **RAG Security Scanner** (poison detection + adversarial-retrieval test) | Ties to RAG work; differentiates | M |
| 6.4 | **MCP Kill-Chain Test Rig** (malicious MCP servers + assertion harness) | Productizes MCP-parity work | S |
| 6.5 | **AI Incident Forensics** (trace replay, root-cause timeline, EU AI Act/ISO export) | Splunk-for-agents; uses forensics + compliance exporter | L |
| 6.6 | **"Hack-the-Agent" CTF arena** (community + real attack data feed for 1.1) | Community + data moat | L |
| 6.7 | **Multi-Agent "AI SOC" simulator** (mixed benign/malicious agents, containment score) | Demo + regression suite | M |

---

## Suggested execution order (senior-engineer sequencing)

1. **Week 1:** Phase 0 (0.1–0.5) → security clean. Then Phase 1.1–1.2 start (curate independent set).
2. **Week 2–3:** Phase 2.1–2.4 (attacker agent + semantic-bypass fuzzer) — this *generates* data for Phase 1.1 too.
3. **Week 3–4:** Phase 1.3–1.6 (calibration, accuracy card) + Phase 3.1–3.2 (public harness + comparison).
4. **Week 5+:** Phase 4.6 (judge calibration), Phase 5 (GTM), then Phase 6 picks.

**North-star metric:** by end of Phase 2, publish **"semantic-only attack bypass rate"** and a **calibrated threshold recommendation** — those two numbers make ARTSA a credible, reviewable guardrail.
