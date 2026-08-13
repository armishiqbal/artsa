# ADR-002: Standardized API Response Envelope

**Status:** Accepted  
**Date:** 2026-08-11  
**Deciders:** ARTSA Platform Security Team

## Context

The ARTSA API initially returned raw domain objects directly (e.g., `Alert`,
`RiskScore`, `ContainmentVerdict`) with varying shapes across endpoints. Client
SDKs and integrators had to handle inconsistent response formats, making error
handling brittle and versioning difficult.

## Decision

Wrap all JSON API responses in a **standardized envelope** via middleware
(`ResponseEnvelopeMiddleware`).

### Successful Response (2xx)

```json
{
  "success": true,
  "data": <original response>,
  "meta": {
    "timestamp": "2026-08-11T12:00:00Z",
    "version": "0.3.0",
    "request_id": "uuid",
    "latency_ms": "12.34"
  }
}
```

### Error Response (4xx/5xx)

```json
{
  "success": false,
  "error": {
    "code": 403,
    "message": "Session contained",
    "type": "AUTHORIZATION_ERROR"
  },
  "meta": {
    "timestamp": "2026-08-11T12:00:00Z",
    "version": "0.3.0",
    "request_id": "uuid",
    "latency_ms": "3.21"
  }
}
```

### Exclusions

The following paths bypass envelope wrapping to avoid breaking probes and protocol
handshakes:

- `/api/v1/health`, `/api/v1/ready` — Kubernetes liveness/readiness probes
- `/api/v1/metrics/prometheus` — Prometheus scrape endpoint (non-JSON)
- `/api/v1/websocket` — WebSocket upgrade handshake
- `/docs`, `/openapi.json`, `/redoc` — OpenAPI schema endpoints

### Error Types

| HTTP Status | Error Type |
|---|---|
| 400 | `VALIDATION_ERROR` |
| 401 | `AUTHENTICATION_ERROR` |
| 403 | `AUTHORIZATION_ERROR` |
| 404 | `NOT_FOUND` |
| 409 | `CONFLICT` |
| 422 | `UNPROCESSABLE_ENTITY` |
| 429 | `RATE_LIMIT_EXCEEDED` |
| 5xx | `INTERNAL_ERROR` |

## Consequences

- **Positive:** Clients can rely on a single response shape for success and error
  paths.
- **Positive:** `request_id` enables end-to-end tracing across distributed systems.
- **Positive:** `version` field enables clients to detect API version mismatches.
- **Negative:** Existing API consumers must update to unwrap `data` from the
  envelope. Mitigated by updating both SDKs simultaneously.
- **Negative:** Slightly larger response payloads (~50–80 bytes overhead).
