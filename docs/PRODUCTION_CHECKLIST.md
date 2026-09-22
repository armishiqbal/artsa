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
| `ARTSA_CUSTOM_INTEGRATION_DEAD_LETTER_RETENTION_DAYS` | replay window for encrypted failed connector payloads (30 default) |

Startup **fails** if production is missing API keys/OIDC, weak `SECRET_KEY`, or wildcard CORS.

### Datastore secret contract

Production also fails fast if it uses SQLite, a default/short database password,
or an unauthenticated/default Redis URL. Use at least 16-character generated
secrets; do not use `postgrespassword`, `password`, or credentials from sample
files.

For Docker Compose, export both values before starting services:

```bash
export POSTGRES_PASSWORD="$(python -c 'import secrets; print(secrets.token_urlsafe(32))')"
export REDIS_PASSWORD="$(python -c 'import secrets; print(secrets.token_urlsafe(32))')"
docker compose up --build
```

For Helm, create an externally managed Kubernetes Secret containing
`SECRET_KEY`, `ARTSA_API_KEY`, `DATABASE_URL`, `REDIS_URL`,
`POSTGRES_PASSWORD`, and `REDIS_PASSWORD`; set `secrets.existingSecret` to its
name. When enabling ingress, `ingress.tlsSecretName` is mandatory. The chart
does not ship credentials or permit an unauthenticated Redis deployment.

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
- [ ] Set and document custom-integration dead-letter retention; successful
      payload ciphertext is erased immediately, but failed payloads remain
      encrypted and replayable until the configured expiry
- [ ] API/Celery images run as non-root; verify admission policy accepts the
      chart's `RuntimeDefault` seccomp and dropped Linux capabilities
- [ ] Enable the supplied datastore NetworkPolicies after allowing required
      DNS, OIDC, LLM-provider, and SIEM egress destinations

## 5. Observability

- [ ] Prometheus scrape `/api/v1/metrics/prometheus`
- [ ] Dashboard (Command Center / Observatory / Risks) behind auth
- [ ] Replay enabled for incident review
- [ ] Structured logs at WARNING+ for auth failures (no secrets)
- [ ] Have operators label validated cases through `POST /api/v1/reviews` and
      read `GET /api/v1/reviews/metrics`; these are the only live FP/FN rates,
      distinct from campaign or benchmark recall

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
- [ ] Verify one connector failure appears as `DEAD_LETTER`, retry it through
      `/integrations/{name}/deliveries/{delivery_id}/replay`, and confirm the
      receiver deduplicates `Idempotency-Key`

## 7. Related docs

- [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) — all wiring patterns
- [ENV_SETUP.md](./ENV_SETUP.md) — env details
- [OIDC_SETUP.md](./OIDC_SETUP.md) — SSO
- [backend/docs/API_SURFACE.md](../backend/docs/API_SURFACE.md) — routes
