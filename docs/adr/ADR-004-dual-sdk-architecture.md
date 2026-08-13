# ADR-004: Dual SDK Architecture (Sync + Async)

**Status:** Accepted  
**Date:** 2026-08-11  
**Deciders:** ARTSA Platform Security Team

## Context

The ARTSA Python SDK initially provided only a synchronous `ArtsaClient` backed by
the `requests` library. As integrators adopted async frameworks (FastAPI, async
LangChain, asyncio-based agents), the blocking HTTP calls caused event loop
starvation and degraded agent throughput.

## Decision

Provide **both** synchronous and asynchronous clients in the Python SDK, with a
shared API surface:

- `artsa.ArtsaClient` — sync, `requests`-based, existing API preserved.
- `artsa.AsyncArtsaClient` — async, `httpx`-based, context-manager support.

### Shared Design Principles

1. **Identical method signatures** where possible (`monitor_tool_call`,
   `guard_tool_call`, `enforce_session`, `ready`).
2. **Fail-closed by default** in both clients.
3. **Exponential backoff retry** with configurable max retries.
4. **Same `ArtsaBlockedError` exception class** for enforcement blocks.
5. **`ARTSA_FAIL_CLOSED` env var** overrides in both clients.

### Async Client Extras

- **Context manager support:** `async with AsyncArtsaClient(...) as client:`
- **External httpx client injection:** Pass an existing `httpx.AsyncClient` to
  share connection pools.
- **Additional methods:** `health()`, `create_session()` for common async workflows.

## Consequences

- **Positive:** Async frameworks (FastAPI, asyncio) integrate without event-loop
  blocking.
- **Positive:** Shared connection pools reduce TCP handshake overhead.
- **Positive:** Existing sync users are unaffected — no breaking changes.
- **Negative:** Two client implementations to maintain. Mitigated by sharing
  the same logic structure and test patterns.
- **Negative:** `httpx` is a new dependency for the SDK (previously only `requests`).
  Acceptable because `httpx` is the de facto async HTTP library in the Python
  ecosystem (used by FastAPI itself).

## SDK Dependencies

| SDK | HTTP Library | Dependencies |
|---|---|---|
| Python (sync) | `requests` | `requests>=2.31.0`, `pydantic>=2.7.0` |
| Python (async) | `httpx` | `httpx>=0.27.0`, `pydantic>=2.7.0` |
| TypeScript | `fetch` (native) | None (zero-dependency) |
