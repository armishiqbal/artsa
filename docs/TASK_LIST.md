# ARTSA — Full Task List (2026-08-19, updated 2026-08-21)

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
> **0.375→0.667** (40-sample batch), golden ECE 0.0742→0.0703. See
> `docs/ACCURACY.md` (now records embedding run conditions) and
> `backend/tests/test_obfuscation.py`.
>
> **2026-08-21 update — weak-class closure + Phase 6.2/6.3 shipped (local).**
> Independent-set recall@80 **0.375 → 0.505** (`ARTSA_EMBEDDING_MODEL=local-bge-multilingual`):
> reverse_shell **0.40 → 0.88**, credential_unusual **0.19 → 0.50**, cloud_credentials **0.40 → 0.50**,
> multilingual **0.41 → 0.48**. Email-carried exfil closed via semantic phrase family + prompt-injection
> regex rules (regression tests green). **Residual:** obfuscated_injection **0.31** (main gap).
> Recall floor still NOT applied (evidence set, not ship gate). CI regression gate **PASS** (38ms avg).
> **6.2** `artsa-guard` SDK packaged (Py/TS: `score_tool_call`, `scan_prompt`). **6.3** RAG scanner API
> (`POST /api/v1/rag/scan`, `/rag/adversarial-retrieval`). Lakera/Azure comparison still key-gated.
>
> **2026-08-20 (later) — Phase 1.1 growth to 1,000+.** `independent_set.json`
> grown to **1,084 hand-curated samples** (6 curated batches, no generator).
> The independence guard (real embeddings) is green: **0 duplicates** vs the
> generated benchmark. The larger set is a harsher, honest test: recall@80
> **0.315** / FPR@50 **0.031** on 1,084 samples. Building it surfaced four real
> precision bugs, now fixed: (a) `dump` substring matched `json.dumps`/`pg_dump`
> (word-boundary + `.dump`-extension aware); (b) TrajectoryDetector KILLed any
> command-tool external GET (now: public GET → surface 45, exfil carrier /
> metadata / internal-pivot → enforce); (c) goal-drift "exfil" keyword fired on
> defensive queries (content-tool exemption + word boundaries); (d) statistical
> detector flagged `2>/dev/null` and SQLi flagged benign `information_schema`
> introspection (both below the enforcement band now). The documented
> **egress-GET policy** is implemented: bare GETs to public destinations are
> surfaced, uploads/pipes/metadata/internal pivots are enforced. FPR on the
> independent set dropped 12.2% → 3.1%; accuracy-card ECE improved to 0.0595.

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
| 1.1 | **Independent set + guard** (`benchmarks/independent_set.json`, **1,084 curated samples** — 632 malicious / 452 safe, v2.1 + `scripts/check_independence.py` + `scripts/independent_gate.py`). Hand-curated across multilingual (18 langs), obfuscation, tool-confusion, credentials, destructive IaC, exfiltration, reverse shells, benign ops, fp-traps. **Independence guard: 0 duplicates vs generator (real embeddings)**. **Measured (2026-08-21, post weak-class fixes): recall@80 0.505 / FPR@50 0.033** — reverse_shell 0.88, credential_unusual 0.50, cloud_credentials 0.50, multilingual 0.48; obfuscated_injection still 0.31. Recall floor NOT yet applied (gap open; set is evidence, not a gate) | ✅ 1,000+ done; independence guard green; honest numbers published; recall floor still open |
| 1.2 | **Held-out canary set** (`benchmarks/canary_set.json`, 24 samples) — labels stored as SHA-256 hashes so ground truth is unreadable in the repo; `scripts/canary_gate.py` decodes and reports AGGREGATES ONLY. **2026-08-20: recall@80 0.875 / FPR@50 0.000 → PASSES the release floor** (was 0.562/0.125). Closed by Phase-2 obfuscation normalization (homoglyph/leet/rot13/url/base64/hex/unicode-escape), multilingual semantic library, egress-carrier + tunnel rules, and the authenticated-API nuance (FPR). Email-carried exfil addressed in 2026-08-21 weak-class pass (semantic + regex; not tuned against hashed canary). Not wired into CI (release gate, run at ship time) | ✅ infra + **gate now passes** |
| 1.3 | **Calibration layer** (`src/benchmark/calibration.py`): ECE + reliability table + operating-point curve, wired into golden_gate. **Measured: ECE 0.0703** (real embeddings) | ✅ done |
| 1.4 | **Cost-aware threshold** (`optimal_threshold`): FP 1 / FN 10 → recommended threshold **50** (recall 1.0, FPR 0.0 on golden) — reported in every gate run | ✅ done |
| 1.5 | **Contamination audit** (`scripts/contamination_audit.py`): signature-only recall on generated vs golden + shared-token report. **Measured: 0.930 vs 0.818 → 1.14× → LOW self-referentiality** | ✅ done |
| 1.6 | **Accuracy card** (`scripts/accuracy_card.py` → `docs/ACCURACY.md`): date, dataset, methodology, per-class matrix, ECE, recommended threshold, **embedding run conditions** | ✅ done |

## Phase 2 — Agentic red-teaming engine (the flagship + the eval engine)

| # | Task | Why / DoD |
|---|---|---|
| 2.1 | **Red-team mutation engine** (`src/redteam/mutator.py`): deterministic offline mutations — homoglyph/leet/base64/url/hex/unicode-escape/rot13/synonym/comment-inject, with encoding labels | ✅ done `redteam`; **2.1b LLM attacker stage shipped (2026-08-20)**: `src/redteam/llm_attacker.py` generates novel semantic paraphrases via the provider registry, opt-in via `ARTSA_REDTEAM_LLM_ENABLED=true` or `--llm`, offline-safe (returns [] on any failure) |
| 2.2 | **Diversity metric** (`src/redteam/diversity.py`): pairwise embedding distance + cluster count, `diversity_is_healthy` | ✅ done |
| 2.3 | **Detector-layer attribution** (`src/redteam/runner.py`): full vs semantic-disabled engine per attack, per-encoding recall, detector fire counts | ✅ done |
| 2.4 | **Semantic-bypass fuzzer** (`scripts/redteam_gate.py`, `--redteam` flag in golden_gate): regex-invisible semantic catch rate. **2026-08-20 (real embeddings + obfuscation normalization): 0.792** (was 0.031 with the embedding layer silently dead under hash-1024; 0.743 before the multilingual stage). Corpus: 1,175 variants. Per-encoding: multilingual 0.787, bilingual_mix 1.000, base64 0.949, homoglyph 0.762, url 0.729, rot13 0.722 | ✅ engine + normalization + multilingual stage shipped; residual per-encoding gaps documented |
| 2.5 | Fuzz mutations via existing `payload_mutator.py`; add multilingual + Unicode confusables + encoding stages | ✅ **multilingual stage done (2026-08-20)**: curated 8-language phrase dictionary (pt/es/zh/hi/de/fr/ar/ja × 10 intents) + `multilingual`/`bilingual_mix` encodings in `src/redteam/mutator.py`; semantic library expanded to 18 languages + tool-misuse/exfil families. Independent-set multilingual class recall **0.12 → 0.41**; bilingual corpus variants 100% caught |
| 2.6 | Guardrail against self-defeating output: attacker can't see detector internals during generation | ✅ **done (2026-08-20)**: the LLM attacker prompt carries only the base phrase; a static AST test (`test_llm_attacker_module_never_imports_detector_internals`) forbids `src.containment.*`/benchmark/judge imports in the attacker module; deterministic mutator remains internal-free |

## Phase 3 — Public benchmark + leaderboard (credibility moat)

| # | Task | DoD |
|---|---|---|
| 3.1 | Public harness from `golden_gate.py`; documented methodology | ✅ **harness + methodology shipped (2026-08-20)**: all gates support `--json` machine-readable output; `docs/BENCHMARK_METHODOLOGY.md` documents sets, metrics, honesty rules, and exact reproduction commands. Reproducible by third parties |
| 3.2 | **Independent scoring vs Lakera / Azure / other guardrails** on the same held-out set | ✅ **harness shipped (2026-08-20)**: `backend/scripts/external_comparison.py` scores the identical independent-set samples through ARTSA + Lakera Guard + Azure AI Content Safety (key-gated via `LAKERA_API_KEY` / `AZURE_CS_ENDPOINT` / `AZURE_CS_KEY`) and writes `docs/COMPARISON.md`. Without keys it reports ARTSA's numbers + methodology (table is as real as the configured keys) |
| 3.3 | Leaderboard + community sample-submission pipeline | ✅ **backend shipped (2026-08-20)**: `src/benchmark/leaderboard.py` (JSON-backed store), `POST /benchmark/submissions` intake, `GET /benchmark/leaderboard` ranking (recall@80 desc / fpr@50 asc), `scripts/leaderboard_update.py` scores accepted submissions through the engine. Frontend leaderboard page = follow-up polish |
| 3.4 | Contamination guard on public set (submitter samples held out) | ✅ **done (2026-08-20)**: every submission passes the guard — embedding similarity ≥ 0.85 vs golden/independent/generated sets → rejected 409 with reason; exact duplicates rejected; tests cover duplicate/contamination/ranking (8 cases) |

## Phase 4 — Product depth (finish the detection story)

| # | Task | Status |
|---|---|---|
| 4.1 | ✅ Real embeddings (open-source FastEmbed), semantic library 24 phrases, embed cache | ✅ `04d1cff` |
| 4.2 | ✅ MCP containment-engine parity (SQLi/reverse-shell/sensitive via MCP blocked) | ✅ `04d1cff` |
| 4.3 | ✅ Org-policy → scoring (PolicyDetector + policy_score) | ✅ `404619b` |
| 4.4 | ✅ Multi-turn goal-drift detector | ✅ `0f97793` |
| 4.5 | ✅ LLM-judge verifier (off by default, escalate-only) | ✅ `ea2ba0b` |
| 4.6 | **Calibrate the LLM judge** (ECE on its verdicts; cap its power until calibrated) | ✅ **done (2026-08-20)**: `judge_validation.py` computes ECE over judge scores vs human labels and persists `backend/data/judge_calibration.json`; the runtime `JudgeVerifier` consults it as a POWER CAP — an uncalibrated/low-agreement judge is inert, and a calibrated judge adds at most `ARTSA_JUDGE_MAX_RAISE` (25) points, reaching BREACHED only when the raised score crosses the KILL band. 6 tests |
| 4.7 | Multi-tenant unique names (integration `name` per tenant), baselines composite PK | ✅ **done (2026-08-20)**: `custom_integrations` name now unique PER TENANT (`uq_custom_integrations_tenant_name`); `agent_baselines` composite PK `(tenant_id, agent_id)`; baseline repo tenant-scoped; alembic `011_tenant_unique_names` for Postgres; 3 tests |

## Phase 5 — GTM kit (WS-5)

| # | Task | DoD |
|---|---|---|
| 5.1 | 14-day evaluation kit (compose profile, sample traffic generator, "with/without ARTSA" comparison) | ✅ **done (2026-08-20)**: `scripts/eval_kit.py` (deterministic benign+attack traffic, with/without-ARTSA report), Docker `eval` compose profile, `docs/EVAL_KIT.md` |
| 5.2 | One-command per-attack-class demo scripts (one per README row) | ✅ **done (2026-08-20)**: `scripts/demo.py --class <class>` + `make demo CLASS=…` across prompt_injection/jailbreak/system_prompt_extraction/social_engineering/exfiltration/reverse_shell/credential_theft/destructive/sql_injection/ssrf/benign. Surfaced + fixed a real destructive-IaC gap (independent-set destructive_tools 0.18 → 0.42) |
| 5.3 | Public accuracy-card page fed by 1.6 | ✅ **done (2026-08-20)**: `frontend/app/accuracy/page.tsx` (recall/FPR/ECE/threshold + per-class matrix + honesty note); regenerable from `ACCURACY.md` |
| 5.4 | Integration gallery (LangChain/OpenAI tools/MCP/OTEL/CI snippets + screenshots) | ✅ **done (2026-08-20)**: `docs/INTEGRATION_GALLERY.md` + existing `docs/INTEGRATION_GUIDE.md`, `examples/`, `sdk/python`, `sdk/typescript` |

## Phase 6 — Optional product bets (pick 1–2 after Phase 1–2)

| # | Idea | Thesis | Effort |
|---|---|---|---|
| 6.1 | **LLM Firewall Gateway** (OpenAI-compatible proxy: sanitize, redact, policy, per-tenant limits, audit) | ✅ **picked + shipped**: `llm_proxy` + `/v1/proxy` routes + 27 tests + `examples/connected_ai_app.py`. See `docs/PRODUCT_BETS.md` | M |
| 6.2 | **Agent Risk-Scoring SDK** (`pip install artsa-guard` / `npm i artsa-guard`; LangChain/CrewAI/AutoGen/MCP plugins) | ✅ **shipped (2026-08-21)**: `sdk/python` + `sdk/typescript` renamed to **artsa-guard**; `ArtsaGuardClient`, `score_tool_call` / `scoreToolCall`, `scan_prompt` / `scanPrompt`; middleware unchanged. PyPI/npm publish = follow-up | M |
| 6.3 | **RAG Security Scanner** (poison detection + adversarial-retrieval test) | ✅ **shipped (2026-08-21)**: `src/services/rag_scanner.py`, `POST /api/v1/rag/scan`, `POST /api/v1/rag/adversarial-retrieval`, `tests/test_rag_scanner.py`. Frontend UI = follow-up polish | M |
| 6.4 | **MCP Kill-Chain Test Rig** (malicious MCP servers + assertion harness) | ✅ **picked + shipped (2026-08-20)**: `scripts/mcp_rig.py` + `tests/test_mcp_rig.py` (12 scenarios); see `docs/PRODUCT_BETS.md` | S |
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
