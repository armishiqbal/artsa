# ARTSA Quality & Integrity Constraints (`CONSTRAINTS.md`)

This file is the written quality contract for the ARTSA repository. Agents and contributors must never weaken these thresholds or silence checks to pass CI.

## 1. Zero Silent Suppressions

- **TypeScript & ESLint:** Do not add `@ts-ignore`, `@ts-expect-error` (outside explicit negative type tests), or new `eslint-disable` directives in `frontend/`.
- **Python & Ruff:** Do not add blanket `# noqa` suppressions or widen `[tool.ruff.lint] ignore` in `pyproject.toml` beyond the documented FastAPI (`B008`) and defensive startup (`BLE001`) idioms.
- **Test Integrity:** Never add `.skip`, `.todo`, `@pytest.mark.skip`, or strip assertions from existing tests in `frontend/__tests__/` or `backend/tests/` to make a failing check green.

## 2. Claim-Contract & Data Provenance Boundaries

- **Canonical Glossary (`CONTEXT.md`):** Use exact domain terminology from `CONTEXT.md`:
  - **Six-agent chain:** `Research → Curator → Red Team → Target → Judge → Defender` (avoid `swarm` or `multi-agent topology`).
  - **Detection-rate-over-time & Adaptive lift:** Keep the adaptive defense series distinct from the flat static baseline.
  - **Command Center & Detections:** Use `Command Center` for `/command-center` and `Detections` for `/red-team/monitor`.
- **No Fabricated Live Data:** Operational pages (`/command-center`, `/findings`, `/replay`, `/logs`, `/analytics`, `/reports`) and `frontend/app/api/backend/[...path]/route.ts` must only render backend-returned records. Never bundle or fall back to synthetic fixture arrays (`DEFAULT_FINDINGS`, `DEFAULT_SESSIONS`, `DEFAULT_TIMELINES`) in production `frontend/lib/` or `frontend/components/` modules; keep test fixtures strictly under `frontend/__tests__/fixtures/`.
- **Cryptographic Non-Repudiation (`ADR-008`):** Campaign Manager signs the initial Research kickoff; downstream hops (`Research → Curator → Red Team → Target → Judge`, and conditional `Judge → Defender`) must be receiver-verified via `receive_handoff` with digest-only audit records (`body_sha256` + `nonce_sha256`).

## 3. Security & Access Control Invariants

- **Fail-Closed Authentication & RBAC:** Protected routes require valid `X-API-Key`, password-session `Bearer` token, or OIDC token (`backend/src/api/middleware/auth.py` and `rbac_middleware.py`). Tenant resolution (`get_current_tenant`) for password sessions and tenant-bound keys must never allow an unprivileged `X-Tenant-ID` header to cross tenant boundaries.
- **Upload & Media Hardening:** File uploads (`POST /api/v1/auth/me/avatar`) must enforce size limits (`<= 2 MB`), verify file magic-byte signatures against declared MIME types, reject path traversal, and serve static responses with `X-Content-Type-Options: nosniff` and `Content-Security-Policy: default-src 'none'; sandbox`.
- **Secrets Management:** Never commit `.env` files, real provider API keys, or static JWT secrets.

## 4. Verification Floors (Required Before Merge)

| Surface | Gate Command | Minimum Threshold |
| :--- | :--- | :--- |
| **Frontend Types** | `cd frontend && npm run typecheck` | `0` TypeScript errors (`tsc --noEmit`) |
| **Frontend Lint** | `cd frontend && npm run lint` | `0` ESLint errors |
| **Frontend Unit Tests** | `cd frontend && npm test` | `100%` pass rate across Vitest suite |
| **Backend Lint** | `ruff check backend/src/ backend/tests/` | `0` Ruff errors on gated production & test modules |
| **Backend Tests** | `PYTHONPATH=backend pytest backend/tests/` | `100%` pass rate across unit & integration suite |
| **Doc-Config Sync** | `bash scripts/check_doc_config_sync.sh && bash scripts/check_risk_framework_sync.sh` | `0` drift between docs, risk catalog, and code |
