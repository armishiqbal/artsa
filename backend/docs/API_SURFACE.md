# ARTSA API Surface

Unified API at **`backend/src/api/main.py`** — containment + wargame + forensics on one port.

```bash
cd backend && uvicorn src.api.main:app --port 8000
# or from repo root:
npm run dev
```

## Routes (`/api/v1/*`)

| Prefix | Purpose |
|--------|---------|
| `/health` | Health check |
| `/ingest` | Tool call ingestion + containment eval (**returns verdict for enforcement**) |
| `/sessions/*` | Session list, timeline (with evaluations), actions |
| `/agents/*` | Agent registry |
| `/alerts/*` | Security alerts + webhooks |
| `/websocket` | Live telemetry feed |
| `/metrics/dashboard` | Command center metrics |
| `/observatory` | Campaign heatmap + Red Queen + CI gates |
| `/topology` | Live agent graph + threats |
| `/policies` | Org custom detection rules (YAML) |
| `/benchmark/*` | Labeled dataset eval |
| **`/campaigns/*`** | Wargame run, list, status (unified) |
| **`/attack-library`** | Templates + CRUD for custom vectors |
| **`/forensics/analyze`** | Trajectory forensics |
| **`/risks`** | Agentic AI Top 10 + live telemetry |
| **`/mcp/proxy`** | MCP JSON-RPC inspection (tool poisoning) |
| **`/otel/v1/traces`** | OpenTelemetry / OpenInference drift ingest |
| **`/agents/eds/monitor`** | Sub-50ms escape detection fast path |
| **`/agents/trajectory/evaluate`** | Multi-step tool trajectory anomaly scoring |
| **`/compliance/export`** | EU AI Act / NIST export |

## Persistence

- Default: **SQLite** at `backend/data/artsa.db` (`USE_SQLITE=true`)
- Set `USE_SQLITE=false` + `DATABASE_URL` for Postgres
- Tests use in-memory mocks (`ENVIRONMENT=testing`)

## Guardrails

Target agent uses pluggable adapters in `backend/src/agents/guardrails/`:
- Heuristic input/output filters (always)
- **Lakera Guard** when `LAKERA_API_KEY` is set
- **Azure Content Safety** when `AZURE_CONTENT_SAFETY_KEY` is set

## Frontend

`NEXT_PUBLIC_API_URL` defaults to `http://localhost:8000` — single URL for all pages.

## Application integration

See **[docs/INTEGRATION_GUIDE.md](../../docs/INTEGRATION_GUIDE.md)** for every way to wire ARTSA into an AI agent (HTTP ingest, Python SDK, LangChain, OpenAI tools, MCP, OTEL, CI).

Production checklist: **[docs/PRODUCTION_CHECKLIST.md](../../docs/PRODUCTION_CHECKLIST.md)**.

## SLO

- Containment evaluation: **<50ms** per event
- See `backend/tests/benchmarks/test_ingest_latency.py`

## Legacy

- `api-gateway/gateway.py` — deprecated; routes merged into main API
- `backend/src/web/` — deprecated dashboard
