# Phase 2.4 Campaign and Telemetry Verification

## What the automated checks cover

The Phase 2.4 tests are deterministic, in-process checks. They exercise selected campaign, event-bus, projection, containment-store, freshness, and sanitization behavior. They do not constitute a deployed end-to-end test.

The source code provides this intended flow:

```text
CampaignManager → campaign event bus → telemetry projection → telemetry bus
                                                           ↓
                                                REST snapshot / WebSocket
                                                           ↓
                                                    frontend views
```

`test_phase2_4_e2e_verification.py` runs a campaign with deterministic test providers, then inspects in-process buses and the operations snapshot. This proves those components work together in the test process. It does not invoke the campaign REST route, cross a process boundary, connect a browser WebSocket, or contact a real model provider.

## Evidence boundaries

| Test | What it exercises | What it does not establish |
| --- | --- | --- |
| `test_a_deterministic_campaign_execution_and_telemetry_projection` | A deterministic `CampaignManager` run, campaign hop events, in-process telemetry projection, and HMAC hop metadata | External provider behavior, API route execution, browser rendering, or deployed WebSocket delivery |
| `test_b_round_progression_comes_from_campaign_callback` | Callback round progression and the in-process snapshot | A background worker, database-backed progress, or production scheduling |
| `test_c_session_kill_halts_in_process_campaign` | Direct `SessionTracker` action and the manager's next-round containment check | The authenticated HTTP action route or a campaign running in another process |
| `test_d_quarantine_agent_session_enforcement_and_not_wired_status` | Direct session quarantine and the documented agent-identity limitation | Durable agent identity revocation |
| `test_e_telemetry_freshness_states` | Freshness-state calculation from supplied timestamps | A live heartbeat or provider connection |
| `test_f_circuit_breaker_3_blocks_trips_and_denies_operations` | Threshold behavior with a mocked database session | Durable PostgreSQL/SQLite persistence or an HTTP 503 integration path |
| `test_g_security_payload_redaction` | Redaction during in-process event projection | Browser, proxy, or external sink redaction behavior |

Password authentication tests exercise the backend's local test app and stores. They cover token validation, protected-route behavior, roles, bootstrap registration, and tenant isolation. They do not validate a deployed identity provider or a human login against a configured production account.

## Authentication configuration

Protected API routes require authentication by default. Production always requires it. Set `ARTSA_REQUIRE_AUTH=false` only for an explicitly unauthenticated local development environment. Public health, readiness, auth bootstrap/login/status, documentation, metrics scrape, and webhook paths are individually allow-listed by the middleware.

Supported credentials include configured API keys and password-session bearer tokens. Password login also requires `ARTSA_PASSWORD_AUTH_ENABLED=true` and a non-placeholder `SECRET_KEY`; production validates a strong key. OIDC is optional and is not enabled by default. The first password account is bootstrapped into `ARTSA_TENANT_ID`; later registrations require the configured administrator credential.

## Sample and walkthrough data

The public `/demo` experience and explicitly marked landing/Command Center walkthroughs use seeded examples. They are not operational telemetry or experiment results. Operational views should show API-backed records and keep missing classifications, timings, HMAC status, and metrics unknown or unavailable. A disconnected backend must not be presented as a successful live run.

## Isolated localhost run (2026-10-10)

A temporary local backend and frontend were exercised over HTTP and in a browser. Both runs used temporary SQLite runtime directories and had the MongoDB sink disabled. The first run connected to the configured localhost Redis service. A fresh follow-up run pointed Redis at an unused local port and used the in-memory fallback instead.

- The first run confirmed browser password login and bearer-authenticated BFF reads: `/auth/me` and `/telemetry/ops` returned 200; anonymous telemetry returned 401. A spoofed `X-Tenant-ID` did not override the `codex-e2e-tenant` bearer scope.
- That run used an `analyst` account. Its WebSocket ticket request returned 403 under current RBAC, so this role cannot use the current socket-ticket route.
- In the fresh follow-up, the browser loaded `/signup`, created the bootstrap administrator, logged in, and reached the protected Command Center. The BFF issued a WebSocket ticket with 200; the backend accepted the ticketed socket and the browser showed `WS CONNECTED`.
- An authenticated deterministic one-round campaign started through the BFF and completed. The authenticated telemetry snapshot reported `LIVE`, one completed round, three `attack`, `response`, and `verdict` events, and HMAC state `ok`. The connected browser displayed those three backend records.

The temporary SQLite runtimes and local web processes were removed/stopped after the runs. The campaign used the deterministic test provider, so this check did not exercise an external model provider, OIDC identity provider, deployed database/worker topology, or production Redis configuration.

## Checks needed for a deployed end-to-end claim

Before describing the full runtime as verified, run a controlled deployment check that confirms each boundary separately:

1. Authenticate with the intended production credential and verify tenant-scoped reads and writes.
2. Start a campaign through the authenticated API using a configured target provider, and capture the provider response and persisted campaign state.
3. Confirm each emitted round is persisted and appears in the authenticated REST telemetry snapshot.
4. Connect a browser client to the authenticated WebSocket, confirm those same event IDs arrive, and check reconnect/replay behavior.
5. Submit a containment action through the API and confirm its returned state, persisted session state, and next-round enforcement.
6. Repeat with the configured database, Redis, worker topology, and provider credentials used by the target deployment.

Until those deployment checks pass, report the evidence as isolated localhost behavior plus deterministic in-process and backend unit/integration coverage, not complete deployed end-to-end operation.
