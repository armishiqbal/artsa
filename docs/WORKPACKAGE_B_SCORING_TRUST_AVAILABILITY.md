# WORKPACKAGE B — Scoring integrity, false positives & trust (stop blocking good work, report honestly)

**Owner:** Agent B · **Source evidence:** `docs/PM_QA_ASSESSMENT_2026-08-13.md`
**Branch:** create `fix/scoring-trust-availability` from `main`. **Do not** add new detectors for the four missed attack classes (SQLi, tool-input prompt-injection, MCP destructive, sensitive-file list) — that's Agent A. Coordinate on shared files only via the assessment doc.

---

## 1. Goal

(1) Stop the engine from **KILLing benign operations** (availability), (2) make the **score explainable and composable** so sub-scores sum to the headline, (3) make the **dashboard and gates report honestly**, (4) fix the **MCP proxy threshold** so a single dangerous signal blocks, (5) fix **route/docs drifts**. These are the product's trust problems — a security tool that blocks normal work and claims 100% defense is not credible.

## 2. What is broken (verified)

| # | Problem | Live proof |
|---|---|---|
| B1 | `exec_command ls -la /tmp` → **95 BREACHED → KILL** | `PRIVILEGE_ESCALATION` + `GOAL_DRIFT` |
| B2 | `read_file /etc/hosts` → **90 BREACHED → KILL** | `GOAL_DRIFT` + `SENSITIVE_DATA_EXPOSED` |
| B3 | ingest returns `rule_based/statistical/semantic/goal_drift_score = 0.0` while `overall = 90` | attribution broken |
| B4 | Dashboard `defense_layers` always **100.0** | detector map matches nothing |
| B5 | Observatory labels recall 0.596 as PASSING (floor is 0.40) | gates are meaningless |
| B6 | MCP proxy: single `delete_user` / `/etc/passwd` / `rm -rf` → **PASSED** | +3 per pattern, needs ≥ 4 |
| B7 | `/health` → **404** (README documents it) | route drift |
| B8 | README says "block at 80–100" but proxy blocks at **≥ 60** | docs/config drift |

## 3. Root causes (confirmed in code)

- **B1:** `StatisticalDetector` (`src/containment/detectors/statistical.py:52-71`) — any tool in `PRIVILEGED_TOOLS` whose argument string Shannon-entropy ≥ threshold is scored `75 + entropy` as `PRIVILEGE_ESCALATION`. Ordinary commands (`ls -la /tmp`) have high character variety → CRITICAL. Entropy of a command string is **not** a security signal.
- **B2:** `GOAL_DRIFT` is emitted by the trajectory path (`StepwiseActionMonitor`, `backend/src/agents/action_monitor.py`; `TrajectoryDetector` `backend/src/containment/detectors/trajectory.py`) which classifies `read_file /etc/hosts` as high-risk (its sensitive-path/high-risk lists include benign system files). On a single-event session the per-step anomaly becomes the whole score.
- **B3:** `CompositeScorer` (`backend/src/containment/scoring/composite.py:35`) = pure **MAX** of sub-scores; ingest serializes the sub-score fields but they're per-detector maxes that don't combine to the headline (and often are 0.0 when a single detector fired).
- **B4:** `_compute_defense_layers` (`backend/src/api/routes/metrics.py:15-64`) keys (`tool_validator`, `statistical_inspector`, …) match **no real detector** → always falls through to the `100.0` default.
- **B6:** `MCPProxyInterceptor` (`backend/src/services/mcp_proxy.py:108-116`) — each injection pattern adds **+3.0**; `is_safe = threat_score < 4.0`. A single match (3.0) always passes.
- **B5:** `RECALL_FLOOR_AT_80 = 0.40` (`backend/scripts/ci_regression_gate.py`).

## 4. Tasks

### B1. Kill the entropy-as-privilege false positive (P0 — availability)
Rework `StatisticalDetector`'s privileged-tool branch:
- Do **not** score privilege/escalation from argument-string entropy alone.
- Option A (preferred): baseline-aware behavior — flag a privileged tool only if it diverges from **this session's** benign tool history, or requires **2+ independent signals** (e.g., entropy spike AND sequence anomaly AND rate spike).
- Option B: explicit benign-command allow-list (`ls`, `cat`, `head`, `tail`, `grep`, `pwd`, `echo`, `mkdir`, `cp`, `mv`, `chmod` with safe args…) that suppresses the escalation flag, keeping detection for genuinely destructive args (`rm -rf`, redirects, pipes to `sh`, `base64 -d`).
- Either way: **`ls -la /tmp` must come back SAFE**. Keep `rm -rf /`, `cat /etc/shadow`, `curl 169.254.169.254`, reverse shells at ≥ 90.

### B2. Stop `GOAL_DRIFT` from flagging benign system files (P0)
Audit `StepwiseActionMonitor`'s high-risk tool / sensitive-path lists (`backend/src/agents/action_monitor.py:12-25`):
- Remove benign system files (`/etc/hosts`, `/etc/hostname`, `/etc/timezone`, `/proc/…`, `/sys/…`, `ls` output) from "high risk".
- Require **multi-step** drift evidence before emitting `GOAL_DRIFT` on a single-event session — one benign file read must never equal a KILL. If a single suspicious file is the signal, it should be `SENSITIVE_DATA_EXPOSED` (Agent A's domain), not `GOAL_DRIFT`.
- Acceptance: `read_file /etc/hosts` → **SAFE** (or at most ALERT); `read_file ~/.aws/credentials` stays the responsibility of A4 (≥ 85).

### B3. Make the composite score explainable (P1)
Replace/adjust `CompositeScorer.calculate_score` (`composite.py`) so that:
- The reported sub-scores (`rule_based_score`, `statistical_score`, `semantic_score`, `goal_drift_score`, plus any new ones) **explain the headline** — either a documented weighted combination that sums/aggregates to `overall`, or at minimum: `overall` is derived from the sub-scores and the response no longer shows `0.0/0.0/0.0/0.0` with `overall=90`.
- Weighted combination is preferred (a calibrated mix of rule + statistical + semantic + trajectory), clamped to [0,100], so a single weak signal can't silently dominate and multiple strong signals compound.
- Keep verdict bands intact: ≥80 KILL, ≥50 QUARANTINE, else SAFE. **Do not** change verdict semantics without flagging it — the benchmark expects them.
- Verify: for a probe that returns overall 90, at least one sub-score ≥ 80 is visible, and the reasoning string names the deciding detector.

### B4. Fix the dashboard defense-layer metrics (P1 — honesty)
In `backend/src/api/routes/metrics.py`, either:
- Map `_compute_defense_layers` to **real** detectors (RuleBased, Statistical, Semantic, GoalDrift, Trajectory, CanaryToken, ToolOutput, PromptInjection) and compute real per-layer stats from ingest telemetry; or
- Drop the constant-100.0 layer and replace with measured values (e.g., benchmark recall/precision, detector fire rates) that the SOC can trust.
- **Never** report 100.0 by default. Add a test asserting defense layers ≠ 100 when the benchmark shows recall < 1.

### B5. Confidence calibration + evidence in reasoning (P1)
- The verdict `confidence` is a fixed heuristic (`engine.py:45-53`). Add per-detector **evidence** (matched pattern, score, span, similarity) into the verdict `reasoning` so operators see *why* — the `SecurityEvent.evidence` dicts already exist (`canary_token.py:110-116`, `tool_output_scanner.py:149-155`, `semantic.py:56-60`). Surface them.
- If time permits, calibrate confidence to measured precision@score from the benchmark.

### B6. Fix the MCP proxy threshold (P1)
`backend/src/services/mcp_proxy.py:108-116`: a **single** dangerous pattern must block. Suggested: each CRITICAL pattern (`delete_user|drop_table|rm -rf`, `/etc/passwd|/etc/shadow`, `system override`, cloud metadata) → threat_score ≥ 8 (hard deny) so one hit ⇒ BLOCKED; keep `tools/list` and benign `tools/call` passing. Add unit tests in `backend/tests/` for single-signal blocks.

### B7 + B8. Route & docs drift (P2)
- `/health` 404s: make `/health` work (alias to `/api/v1/health`) or update README/scripts (`npm run verify` checks it).
- README "block at 80–100" vs proxy `block_threshold=60` in sanitize mode: make docs match config (proxy blocks SUSPICIOUS ≥ 60 by design) and say so explicitly, or change the config if 60 was unintended.

## 5. Definition of done (run these yourself)

```bash
cd backend && ENVIRONMENT=testing PYTHONPATH=. python -m pytest tests/ -q          # all pass (plus new B tests)

# availability: these must be SAFE (score < 50) or at most ALERT, never KILL
#   exec_command ls -la /tmp · read_file /etc/hosts · exec_command "grep error /var/log/app.log"
# the following must STILL be ≥ 90 (no regression from Agent A):
#   exec_command rm -rf / · execute_command cat /etc/shadow · execute_command curl 169.254.169.254/latest/meta-data/

# explainability: ingest a read_file /etc/passwd and confirm overall≥80 AND at least one sub-score≥80 AND reasoning names the detector

# MCP proxy: single-signal must block
#   POST /api/v1/mcp/proxy  {"method":"tools/call","params":{"name":"delete_user","input":"delete all users"}} → is_safe:false
#   POST /api/v1/mcp/proxy  {"method":"tools/call","params":{"name":"read_file","input":"/etc/passwd"}}      → is_safe:false

# metrics honesty: GET /api/v1/metrics/dashboard → defense_layers are no longer a constant 100.0 (or are replaced by measured values)

# routes/docs: GET /health → 200; README block-threshold text matches config
```

## 6. Non-goals (leave for Agent A)

Adding the SQL / tool-input prompt-injection / MCP-destructive / sensitive-file detectors, extending the benchmark malicious set, and raising the recall gate floor. If you encounter missing detectors while testing, note file/line — don't implement.
