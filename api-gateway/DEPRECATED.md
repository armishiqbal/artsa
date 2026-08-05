# DEPRECATED — do not deploy this package.

All routes live in the unified containment API: `backend/src/api/main.py` (port 8000).

This directory remains only for backward-compatible unit tests that import
`mcp_proxy` / `otel_ingest` historically. Prefer:

- `backend/src/services/mcp_proxy.py`
- `backend/src/services/otel_ingest.py`
- `backend/src/api/routes/enterprise.py`

See `docs/INTEGRATION_GUIDE.md` and `docs/PRODUCTION_CHECKLIST.md`.
