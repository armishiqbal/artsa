# ARTSA — Production Readiness Checklist

Use this before putting ARTSA in front of a real AI agent fleet.

## 1. Environment

Copy `.env.example` → `.env` and set:

| Variable | Production value |
|----------|------------------|
| `ENVIRONMENT` | `production` |
| `SECRET_KEY` | ≥32 char random (`python -c "import secrets; print(secrets.token_urlsafe(64))"`) |
| `ARTSA_API_KEY` | strong secret (or enable OIDC) |
| `ARTSA_CORS_ORIGINS` | explicit origins (never `*`) |
| `ARTSA_REQUIRE_AUTH` | `true` (auto when `ENVIRONMENT=production`) |
| `USE_SQLITE` | `false` + Postgres `DATABASE_URL` |
| `REDIS_URL` | real Redis |
| `ARTSA_AUTO_ENFORCE` | `true` (default) — auto KILL/QUARANTINE sessions |
| `ARTSA_BLOCK_CONTAINED_SESSIONS` | `true` (default) — reject further ingest |
| `ARTSA_RATE_LIMIT_RPM` | sized for your traffic |

Startup **fails** if production is missing API keys/OIDC, weak `SECRET_KEY`, or wildcard CORS.

## 2. Deploy checks

```bash
curl -s http://localhost:8000/api/v1/health   # liveness
curl -s http://localhost:8000/api/v1/ready    # readiness (503 if not ready)
curl -s http://localhost:8000/api/v1/metrics/prometheus
```

Wire `/ready` into k8s/load-balancer readiness probes.

## 3. Agent enforcement (required)

ARTSA returns verdicts; your runtime must enforce:

```python
from artsa import ArtsaClient

client = ArtsaClient(api_url=..., api_key=..., fail_closed=True)
client.guard_tool_call(session_id, agent_id, tool_name, arguments)
# only then execute the tool
```

Or run the sample: `python examples/production_agent.py`

With `ARTSA_AUTO_ENFORCE=true`, ingest also marks the session `BREACHED`/`QUARANTINED` server-side. Contained sessions get **403** on further ingest.

## 4. Security controls

- [ ] API keys rotated; never in `NEXT_PUBLIC_*`
- [ ] OIDC configured for human operators (optional)
- [ ] RBAC role keys for analyst / redteam / readonly
- [ ] TLS terminated in front of API (ingress / reverse proxy)
- [ ] Network allow-list for ingest clients
- [ ] Alert webhooks to Slack/PagerDuty
- [ ] Backup Postgres + retention policy

## 5. Observability

- [ ] Prometheus scrape `/api/v1/metrics/prometheus`
- [ ] Dashboard (Command Center / Observatory / Risks) behind auth
- [ ] Replay enabled for incident review
- [ ] Structured logs at WARNING+ for auth failures (no secrets)

## 6. Validation before go-live

```bash
# Backend tests
cd backend && PYTHONPATH=. pytest -q

# SDK
cd sdk/python && PYTHONPATH=. pytest -q

# Red-team smoke
# UI → Wargame, or CI artsa.test against a staging target
```

- [ ] Safe tool allowed
- [ ] Malicious tool blocked (`KILL`/`QUARANTINE`)
- [ ] Contained session rejects next tool
- [ ] Fail-closed: stop agent if `/ready` fails
- [ ] Risk JSON synced: `bash scripts/check_risk_framework_sync.sh`
- [ ] Helm probes hit `/api/v1/health` + `/api/v1/ready`

## 7. Related docs

- [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) — all wiring patterns
- [ENV_SETUP.md](./ENV_SETUP.md) — env details
- [OIDC_SETUP.md](./OIDC_SETUP.md) — SSO
- [backend/docs/API_SURFACE.md](../backend/docs/API_SURFACE.md) — routes
