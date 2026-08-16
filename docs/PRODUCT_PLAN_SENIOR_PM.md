# ARTSA — Senior Product Manager Plan (v0.4 → v1.0)

**Date:** 2026-08-16 · **Version reviewed:** v0.3.0 (post Workpackages A+B) · **Basis:** live repo inspection, benchmark gate run, PM QA assessment (2026-08-13), workpackage docs.

---

## 1. Where the product actually stands

| Dimension | Measured today | Verdict |
|---|---|---|
| Real-time containment latency | 0.66 ms in-engine; ~10 ms over HTTP | 🟢 Exceeds 50 ms SLO |
| Benchmark accuracy (520-sample synthetic v3) | recall@80 = 1.0, precision@80 = 1.0, FPR@50 = 0.0 | ⚠️ Suspiciously perfect — self-generated set |
| Detection coverage | SQLi, tool-input PI, MCP-destructive, sensitive-file, run_code/eval KILL all landed (Workpackage A) | 🟢 Good progress |
| Scoring integrity | Weighted, explainable composite; entropy false-positive removed; honest defense-layer metrics (Workpackage B) | 🟢 Good progress |
| Goal-drift (multi-turn) | **Stub** — literal `"exfiltrate"` substring only | 🔴 Not implemented |
| Semantic/AI scanner in real-time | 1024-dim hash embeddings vs. a handful of phrases; no inline LLM judge | 🔴 Thin |
| RAG policy knowledge → scoring | Only steers target prompts; **no influence on any risk score** | 🔴 Claim unfulfilled |
| Red Queen adaptation | Frozen constant series (display artifact) | 🔴 Not real |
| Multi-tenancy / org isolation | None (row-level) | 🔴 Blocks enterprise sales |
| Test suite | 46 test files, 284+ passing; CI gates recall@80 ≥ 0.85 | 🟢 Healthy |
| Working tree | Uncommitted auth/mongo-sink/alembic work in progress | 🟡 Risk of loss |

**Core strategic message:** ARTSA is now a *believable detection framework* with excellent latency and an honest scoring core. The single biggest risk is no longer code — it is **evidence**. 100% accuracy on a benchmark generated from the same regexes as the detectors is not proof of anything a security buyer trusts. Everything else in the roadmap serves making that number defensible.

---

## 2. Strategic reframe (the "what needs to change" part)

1. **Stop selling "100% defense"** — start selling "measured, bounded risk." Replace the claim with a public accuracy card: recall@X, FPR@Y, latency p99, benchmark provenance.
2. **Treat the benchmark as untrusted input until it's independent.** A self-labeled, in-repo dataset cannot be the product's proof. This is the #1 change.
3. **Move from "demo-ware" to "trial-ware":** a 10-minute demo exists; a 14-day enterprise evaluation (real traffic replay, honest metrics) does not.
4. **Re-position the Red Queen / evolution engine:** either make it real (policy that improves from outcomes) or remove it from the UI. A frozen "adaptation" widget damages credibility with the exact buyers who understand it.
5. **Finish what's in the working tree before adding surface area.** Uncommitted auth + mongo sink work is a release risk, not a feature.

---

## 3. The plan — 5 workstreams

### WS-1 · Trust & Measurement (P0 — do first, everything depends on it)
**Goal:** numbers a CISO can defend in a procurement review.

| # | Task | Definition of done | KPI |
|---|---|---|---|
| 1.1 | **Independent evaluation set.** Build a curated real-world golden set (real prompts, real tool calls, adversarial + benign) that the detector authors never see. Version it separately from the repo's generated set. | Golden set ≥ 1,000 samples; frozen; run in CI as a *separate* gate | Hold-out recall@80, FPR@50 published |
| 1.2 | **Overfit audit.** Split generated v3 dataset into train/holdout; report per-class accuracy (SQLi, PI, MCP, sensitive-file, code-exec, egress…). Kill any detector that only matches its own generator. | Per-class confusion matrix in CI artifact | No class below 0.85 recall on holdout |
| 1.3 | **Live canary + false-positive telemetry.** Track post-deployment verdicts per detector: catch rate and FP rate from real traffic, weekly. | Dashboard panel "measured effectiveness" from telemetry (work already started in `metrics.py`) | FP rate on benign ops ≤ 1% |
| 1.4 | **Honest accuracy card.** Generate `ACCURACY.md` + PDF export from gate runs with date, dataset, methodology. | Auto-published on every CI run | Sales/audit artifact exists |
| 1.5 | **Ablation → product proof.** Use the ablation harness to publish "which layer catches what" per attack class. | Table of detector→class coverage in Reports | Feature-level coverage visible to customers |

**WS-1 exit criteria:** golden-set recall@80 ≥ 0.85 and FPR@50 ≤ 0.05, published with methodology, and the v1.0 README makes no unmeasured claim.

### WS-2 · Detection depth (P0 — close the real gaps)
**Goal:** the README's headline scenarios become true.

| # | Task | Definition of done |
|---|---|---|
| 2.1 | **Real multi-turn goal drift.** Replace the `"exfiltrate"` stub with a trajectory model: intent summary, deviation scoring vs. declared goal, session-state features. | 3-turn drift probe (benign → crawl → exfiltrate) scores ≥ 80; benign long sessions stay SAFE |
| 2.2 | **Inline semantic scoring.** Swap hash-embedding path for a real embedding model (or the configured provider) in real-time mode, with latency budget. | Semantic detector p99 < 10 ms; cosine hits on adversarial phrasing |
| 2.3 | **Optional LLM-judge fast path.** For high-entropy/borderline verdicts (40–79 band), route through a fast judge model with a 200 ms budget; used for verification, not inline by default. | Borderline verdicts get a judge reason in evidence |
| 2.4 | **RAG policy → scoring.** Wire policy knowledge into scoring (e.g., "this org forbids X tool" raises the score when policy matches). | Policy rule change alters live scores; test coverage |
| 2.5 | **MCP parity.** Run MCP traffic through the full containment engine (not the 7-regex list), or at minimum mirror engine detectors into the proxy. | MCP destructive probe blocked with same score as ingest path |
| 2.6 | **Red Queen — real or removed.** Either close the loop (verdict outcomes → policy suggestions, human-approved) or remove the frozen series from the UI. | No display artifact; UI shows only real adaptation data |

**WS-2 exit criteria:** all README scenarios reproducible in a single scripted demo; goal-drift and semantic claims test-covered.

### WS-3 · Enterprise readiness (P1 — what unlocks revenue)
| # | Task | Definition of done |
|---|---|---|
| 3.1 | **Multi-tenancy.** Row-level org isolation on all data paths (alerts, telemetry, campaigns, reports, settings). | Two tenants cannot see each other's data; RBAC × tenant matrix tested |
| 3.2 | **Audit & compliance export.** Signed, immutable audit log export (JSON/PDF) with tamper-evidence; compliance report generator already exists — add evidence attachments. | Auditor walkthrough with report + raw evidence |
| 3.3 | **Incident response workflow.** Alertmanager rules, on-call routing, escalation, and "quarantine → release" state transitions in UI. | Alert → page → acknowledge → resolve flow in a live demo |
| 3.4 | **SLO/SLA surface.** Uptime + latency SLO dashboard and health endpoints used by monitors. | `/health`, `/ready` consumed by external monitor; SLA report |
| 3.5 | **Edition/pricing map.** Free (community) vs. Pro (SaaS) vs. Enterprise (self-host, SSO, multi-tenant, audit) — feature-gate cleanly. | Feature flags mapped; docs updated |

### WS-4 · Ship hygiene (P0 — immediate, one sprint)
| # | Task | Definition of done |
|---|---|---|
| 4.1 | **Commit the working tree.** Auth/users, password auth, mongo sink, alembic 004 — commit with tests, or explicitly shelve. | `git status` clean; CI green |
| 4.2 | **Doc↔config consistency as a gate.** Extend `check_risk_framework_sync.sh` to assert README claims (thresholds, routes) against code in CI. | Config drift fails CI |
| 4.3 | **Kill leftover fake data.** Scan UI for frozen/placeholder series (Red Queen, defense "100%", ablation artifacts) and remove or wire to real data. | UI shows only measured values |
| 4.4 | **Rate-limit + abuse test on public surface.** The proxy and ingest are externally reachable; verify auth/rate-limit/abuse posture. | Pen-test notes closed |

### WS-5 · Go-to-market assets (P2 — parallel, cheap)
| # | Task | Outcome |
|---|---|---|
| 5.1 | **14-day evaluation kit:** docker-compose profile, sample traffic generator, benchmark report template, "what would have happened without ARTSA" comparison view. | Prospects self-serve proof |
| 5.2 | **Per-attack-class demo scripts** (one per README table row) with expected verdicts — scripted, one-command. | 10-minute credible demo, not just wizard |
| 5.3 | **Public accuracy card page** (hosted) fed by WS-1. | Marketing truth |
| 5.4 | **Integration gallery:** LangChain, OpenAI tools, MCP, OTEL, CI — one-click examples already exist (`INTEGRATION_GUIDE.md`); add screenshots + copy-paste snippets. | Developer adoption |

---

## 4. Sequencing & milestones

| Milestone | Focus | Time-box | Exit signal |
|---|---|---|---|
| **v0.4.0 — "Measured"** | WS-4 + WS-1 (1.1–1.3) | 2–3 weeks | Golden set in CI; accuracy card; clean tree |
| **v0.5.0 — "Deep"** | WS-2 (2.1, 2.4, 2.5) | 3–4 weeks | Goal-drift + policy-scored live demo |
| **v0.6.0 — "Enterprise"** | WS-3 (3.1, 3.3) | 4–6 weeks | Tenant-isolated multi-org demo |
| **v1.0.0 — "Trusted"** | Full WS-1 + WS-5 | +2–3 weeks | Public accuracy card, eval kit, honest docs |

**Suggested stop-list (what to NOT build next):** more UI pages, more connector types, more attack-library CRUD, more frozen "adaptation" widgets, more synthetic benchmark classes. All of those are 10% features; the 90% is evidence, depth, and enterprise plumbing.

---

## 5. KPIs the plan is measured against

| KPI | Current | Target (v1.0) |
|---|---|---|
| Golden-set recall@80 (independent) | n/a (not measured) | ≥ 0.85 |
| Golden-set FPR@50 | n/a | ≤ 0.05 |
| Live-traffic FP rate (benign ops) | unmeasured | ≤ 1% |
| In-engine latency p99 | 1.5 ms | ≤ 5 ms |
| MCP/ingest verdict parity | partial | 100% parity |
| Docs↔config drift in CI | manual | 0 drift failures |
| Working-tree release risk | uncommitted WIP | clean tree |

---

## 6. One-paragraph executive summary

ARTSA has done the hard engineering: sub-millisecond containment, honest scoring, all the major attack classes covered, and a CI-gated benchmark. The next 6–8 weeks should be spent making the numbers **provable** (independent evaluation set, per-class coverage, live FP telemetry, a public accuracy card), then closing the two real detection gaps (multi-turn goal drift, policy-aware scoring) and the two revenue blockers (multi-tenancy, incident workflow). Stop polishing the dashboard and the synthetic benchmark; start proving the product to a skeptic.
