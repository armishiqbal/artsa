# AGENTS.md — Operating Rules & Context Guide

## 1. Read First (Context & Contracts)

Before modifying code, routes, or product copy, read:
- **`CONTEXT.md`**: Canonical domain glossary and claim contract (`Six-agent chain`, `HMAC handoff`, `Command Center`, `Detections`, `ASI08`, `Runtime blocking`). Never describe derived, seeded, or unfinished work as live telemetry.
- **`CONSTRAINTS.md`**: Enforced quality bar, zero-suppression rules, security invariants, and required verification gates.
- **`docs/adr/`**: Architecture Decision Records (especially `ADR-008-campaign-agent-execution-and-telemetry.md` for six-agent execution and HMAC verification). See `docs/agents/domain.md`.

## 2. Verification Commands

Run the relevant verification gates before completing any task:

```bash
# Backend lint & tests
ruff check backend/src/ backend/tests/
PYTHONPATH=backend pytest backend/tests/ -q

# Frontend typecheck, lint & unit tests
cd frontend && npm run typecheck
cd frontend && npm run lint
cd frontend && npm test

# Documentation & risk framework sync
bash scripts/check_risk_framework_sync.sh
bash scripts/check_doc_config_sync.sh
```

## 3. Architectural & Code Hygiene Rules

- **No Synthetic Fallbacks in Production Modules:** Operational UI pages and `frontend/lib/` must never return fabricated findings, sessions, or timelines when the backend is empty or unreachable. Keep test fixtures inside `frontend/__tests__/fixtures/`.
- **Atomic Commits (`~100–200` lines):** Split multi-domain changes into focused commits by subsystem (`backend` auth/RBAC/HMAC, `frontend` Command Center, `frontend` Findings/Replay, `docs`/ADRs).
- **Security Boundaries:** Enforce tenant isolation via `get_current_tenant`, keep RBAC permissions explicit in `backend/src/core/rbac.py`, and validate both MIME types and magic bytes on file uploads.

## 4. Issue Tracker & Triage Labels

- **Issue tracker:** GitHub Issues via the `gh` CLI (PRs are not a triage surface). See `docs/agents/issue-tracker.md`.
- **Triage labels:** Canonical roles use matching label strings: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.
