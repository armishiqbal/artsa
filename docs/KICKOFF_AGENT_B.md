# KICKOFF — AGENT B (Scoring integrity, false positives & trust)

Copy the block below and hand it to your Agent B.

---

**Role:** You are a backend security engineer on ARTSA, a real-time guardrail for AI agents.
**Repo:** `/Users/haroonshahid/Adervisal Red Team simulation architecture`
**Full spec:** read `docs/WORKPACKAGE_B_SCORING_TRUST_AVAILABILITY.md` first — it is your source of truth.
**Evidence:** `docs/PM_QA_ASSESSMENT_2026-08-13.md` §3.2–§3.6.

## Before you change anything — establish the baseline

```bash
cd "/Users/haroonshahid/Adervisal Red Team simulation architecture/backend"
ENVIRONMENT=testing PYTHONPATH=. python -m pytest tests/ -q
```
Record the current behavior of the two false-positive probes so you can prove the fix:
- `exec_command ls -la /tmp` → currently **95 / BREACHED / KILL** (should be SAFE)
- `read_file /etc/hosts` → currently **90 / BREACHED / KILL** (should be SAFE)

## Setup

```bash
git checkout main && git pull
git checkout -b fix/scoring-trust-availability
```

## Mission

1. **Stop KILLing benign operations** (availability):
   - `StatisticalDetector` (`backend/src/containment/detectors/statistical.py:52-71`) scores any "privileged tool" with high argument entropy as PRIVILEGE_ESCALATION (`75+entropy`). Ordinary commands have high entropy → `ls -la /tmp` = 95. Replace with baseline-aware or allow-list behavior; require ≥2 independent signals. `ls -la /tmp` must be **SAFE**; keep `rm -rf /`, `cat /etc/shadow`, `curl 169.254.169.254`, reverse shells at **≥ 90**.
   - `GOAL_DRIFT` comes from `StepwiseActionMonitor` (`backend/src/agents/action_monitor.py`) + `TrajectoryDetector` over-classifying benign system files (`/etc/hosts` → 90). Remove benign files from high-risk lists; require multi-step drift evidence before single-event `GOAL_DRIFT`. `read_file /etc/hosts` must be **SAFE** (or at most ALERT).

2. **Make the score explainable** — `CompositeScorer` (`backend/src/containment/scoring/composite.py`) is pure MAX; ingest returns sub-scores `0.0/0.0/0.0/0.0` while overall = 90. Introduce a weighted/calibrated combination so sub-scores explain the headline, and reasoning names the deciding detector. Keep verdict bands: ≥80 KILL, ≥50 QUARANTINE, else SAFE.

3. **Report honestly** — dashboard `defense_layers` always 100.0 (`backend/src/api/routes/metrics.py:15-64`, detector map matches nothing). Map to real detectors or replace with measured values. Never 100 by default.

4. **MCP proxy threshold** (`backend/src/services/mcp_proxy.py:108-116`) — each injection pattern adds +3, needs ≥4 to block, so a single `delete_user`/`/etc/passwd`/`rm -rf` passes. Make a single CRITICAL signal hard-deny (threat ≥ 8) → BLOCKED. `tools/list` and benign calls still pass.

5. **Route/docs drift** — `/health` 404s (README documents it); README says "block at 80–100" but proxy blocks at ≥60 (`block_threshold`). Make docs match config.

## Constraints (do NOT touch)

Adding the SQL / tool-input prompt-injection / destructive-MCP / sensitive-file detectors, extending the benchmark malicious set, and raising the recall gate floor — that's Agent A's scope. If you hit missing detectors, report file:line — don't implement. Coordinate with Agent A if you both need `ContainmentEngine`'s detector list.

## Definition of done — verify all of these

```bash
cd backend && ENVIRONMENT=testing PYTHONPATH=. python -m pytest tests/ -q   # all pass
```
- **Availability (must be SAFE / score < 50):** `exec_command ls -la /tmp` · `read_file /etc/hosts` · `exec_command "grep error /var/log/app.log"`
- **No regression (must stay ≥ 90):** `rm -rf /` · `cat /etc/shadow` · `curl http://169.254.169.254/latest/meta-data/`
- **Explainability:** ingest `read_file /etc/passwd` → overall ≥ 80 AND at least one sub-score ≥ 80 AND reasoning names a detector
- **MCP:** single `delete_user` and `/etc/passwd` → `is_safe: false`; `tools/list` → passes
- **Metrics:** `GET /api/v1/metrics/dashboard` → defense_layers no longer a constant 100.0
- **Routes/docs:** `GET /health` → 200; README threshold text matches config

**Report back:** the two FP probes before/after, sub-score explainability sample, MCP before/after, and the metrics change.
