# ARTSA — Full Task List (2026-08-19)

Senior-engineer-graded backlog. Order = dependencies first: **security → evidence → engine → credibility → product → GTM**. Items marked ✅ are already done; everything else is open.

---

## Phase 0 — Security & correctness (DO NOW — blocks everything)

| # | Task | Why | Status |
|---|---|---|---|
| 0.1 | **Remove BFF hardcoded admin backdoor** (`frontend/app/api/backend/[...path]/route.ts`: `admin@artsa.ai/admin12345` + 2 more + fake `registeredAdmins` Map) | Public admin password in deployed code — a security product shipping this fails any review instantly | 🔴 OPEN |
| 0.2 | **Honest BFF fallback**: backend-unreachable → login/register 503 with "use Explore Live Preview"; health → 503 (UI shows OFFLINE, not fake ONLINE); no internal error-message leaks | Fixes the "API status failed" symptom + honest offline state | 🔴 OPEN |
| 0.3 | Verify no code depends on the fake-auth fallback (E2E smoke + login flow) | Avoid regressions from 0.1/0.2 | 🔴 OPEN |
| 0.4 | Re-run full verification after 0.1–0.3 (lint, tsc, 95 vitest, build, e2e, backend suite) | Gate the change | 🔴 OPEN |
| 0.5 | `git push` + CI green | — | 🔴 OPEN |
| — | ✅ Identity→tenant credential binding (bearer overrides header) | done 2026-08-19 (`147752a`) | ✅ |
| — | ✅ Alert tenant stamping, init_db status column, lint sweep (75 issues), rate-limit tests | done `db29c07`/`147752a` | ✅ |

## Phase 1 — Evaluation credibility (the frontier-lab core — nothing else is real until this)

| # | Task | Why / DoD |
|---|---|---|
| 1.1 | **Independent golden set, no generator**: 1,000+ real-world samples (real traffic + human adversarial curation), frozen, authors never see it | Current 1.0 recall is a self-referential artifact. DoD: set ships separately, provenance documented |
| 1.2 | **Held-out canary set** that never enters the repo; used only for final release scoring | Prevents overfitting the golden set itself |
| 1.3 | **Calibration layer** (`src/benchmark/calibration.py`): ECE + reliability table + operating-point curve, wired into golden_gate. **Measured: ECE 0.074** (scores are reasonably trustworthy) | ✅ done |
| 1.4 | **Cost-aware threshold** (`optimal_threshold`): FP 1 / FN 10 → recommended threshold **50** (recall 1.0, FPR 0.0 on golden) — reported in every gate run | ✅ done |
| 1.5 | **Contamination audit**: assert benchmark classes/labels don't match detector regex sources | Formalizes "the test and the implementation are the same object" risk |
| 1.6 | **Accuracy card** (`scripts/accuracy_card.py` → `docs/ACCURACY.md`): date, dataset, methodology, per-class matrix, ECE, recommended threshold | ✅ done |

## Phase 2 — Agentic red-teaming engine (the flagship + the eval engine)

| # | Task | Why / DoD |
|---|---|---|
| 2.1 | **Red-team mutation engine** (`src/redteam/mutator.py`): deterministic offline mutations — homoglyph/leet/base64/url/hex/unicode-escape/rot13/synonym/comment-inject, with encoding labels | ✅ done `redteam`; LLM-attacker stage (2.1b, `ARTSA_REDTEAM_LLM_ENABLED`) remains |
| 2.2 | **Diversity metric** (`src/redteam/diversity.py`): pairwise embedding distance + cluster count, `diversity_is_healthy` | ✅ done |
| 2.3 | **Detector-layer attribution** (`src/redteam/runner.py`): full vs semantic-disabled engine per attack, per-encoding recall, detector fire counts | ✅ done |
| 2.4 | **Semantic-bypass fuzzer** (`scripts/redteam_gate.py`, `--redteam` flag in golden_gate): regex-invisible semantic catch rate. **Baseline: 0.354 mutation recall; 3.1% regex-invisible semantic catch (hash & fastembed)** — obfuscation evades the semantic layer; next work is obfuscation-normalization + lower thresholds | ✅ engine done; follow-up = improve the number |
| 2.5 | Fuzz mutations via existing `payload_mutator.py`; add multilingual + Unicode confusables + encoding stages | Depth |
| 2.6 | Guardrail against self-defeating output: attacker can't see detector internals during generation | Evals discipline |

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
