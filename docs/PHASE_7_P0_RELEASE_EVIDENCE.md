# Phase 7 P7.0 Release Evidence

**Status:** Partially verified; not release-ready

**Recorded:** 2026-09-15

**Candidate commit:** `1bb0e9b4510d2521cd2fce71b22d271c4d77ac29`

**Candidate subject:** `Fix streaming persistence and reserve full chat token budgets`

## Current gate results

| Gate | Result | Evidence / required resolution |
|---|---|---|
| Documentation whitespace and tracked diff check | Pass | `git diff --check` completed without output after the Phase 7 plan change. |
| Frontend lint | Pass | `npm --prefix frontend run lint` completed with the repository's zero-warning policy after resolving the 42 reported errors and 3 hook-dependency warnings. |
| Frontend typecheck | Pass | `npm --prefix frontend run typecheck` completed successfully. |
| Frontend unit tests | Pass | `npm --prefix frontend run test`: 60 files and 351 tests passed. Existing jsdom chart-size and expected provider-boundary stderr output did not fail the suite. |
| Frontend production build | Pass | `npm --prefix frontend run build` compiled and generated all 72 static pages successfully. |
| Focused managed-MCP and GitHub tests | Pass | `PYTHONPATH=backend ENVIRONMENT=testing python -m pytest backend/tests/unit/test_mcp_http.py backend/tests/unit/test_github_execution.py backend/tests/integration/test_github_containment.py -q --tb=short`: 24 tests passed. |
| Full backend test collection | Incomplete | `PYTHONPATH=backend ENVIRONMENT=testing python -m pytest backend/tests/ --tb=short -q` remained CPU-active for more than four minutes without a completion summary, then was stopped with `SIGTERM`. Re-run with test timing/diagnostics and obtain a complete passing result. |
| Managed GitHub MCP live gate | Not run | Requires the authorized disposable GitHub App installation, dedicated tenant/agent/operator credentials, and `ARTSA_LIVE_EVALUATION=1`. |

## P7.0 exit checklist

- [ ] Frontend lint passes with the repository's zero-warning policy.
- [ ] Backend suite completes and passes with a recorded command, duration, and
      environment.
- [ ] Frontend typecheck, unit tests, production build, Playwright smoke tests,
      SDK tests, benchmark gates, and PostgreSQL integration tests pass or have
      an approved, time-bounded exception.
- [ ] Release artifact records commit SHA, detector/policy versions, migration
      revision, approved local model identifier, and deployment-manifest digest.
- [ ] Operator, security approver, on-call owner, rollback owner, and approval
      response SLO are named.

Do not start monitor mode, enforcement, or a GitHub external-write evaluation
from this candidate until this checklist is complete.
