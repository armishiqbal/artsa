# ARTSA Product Bets — Phase 6 (picks)

> The Phase-6 list is "optional bets; pick 1–2 after Phase 1–2". This document
> records the two bets picked and their shipping status. Both were chosen
> because they productize work already in the codebase (lowest risk, fastest to
> a credible deliverable) rather than starting greenfield.

## Pick 1 — 6.1 LLM Firewall Gateway (OpenAI/Anthropic-compatible proxy)

**Status: shipped** (pre-existing `llm_proxy` + proxy routes; verified this pass).

The gateway is an OpenAI/Anthropic-compatible reverse proxy that sits in front
of the model provider and gates every request with the containment engine:

- `src/gateway/llm_proxy.py` — `decide()` (score → ProxyAction), `sanitize_messages()`
  (safety-warning injection), `forward_chat()` / `stream_chat()` (SSE), OpenAI↔Anthropic
  translation, fail-open/fail-closed policy, blocked-alert + OTel telemetry.
- `src/api/routes/proxy.py` — `/v1/proxy/...` and `/api/v1/proxy/...` endpoints
  (OpenAI & Anthropic compatible) so a client can set
  `base_url=http://localhost:8000/v1/proxy`.
- Per-tenant limits, redaction and full audit ride on the existing policy engine
  and telemetry/alert pipelines.
- Coverage: `tests/test_llm_proxy.py` (27 tests); runnable example in
  `examples/connected_ai_app.py`.

## Pick 2 — 6.4 MCP Kill-Chain Test Rig

**Status: shipped this pass** (`scripts/mcp_rig.py` + `tests/test_mcp_rig.py`).

Productizes the MCP-parity work into a runnable rig that feeds a battery of
malicious MCP server / tool-poisoning scenarios (destructive tools, sensitive
reads, SQLi, reverse shell, metadata SSRF, exfil carriers, destructive IaC,
credential reads, disallowed methods) through the containment engine via
`MCPProxyInterceptor`, and reports which are contained — with benign typed-tool
controls that must pass. Exits non-zero on any miss, so it doubles as an MCP
coverage regression gate.

```bash
PYTHONPATH=. python scripts/mcp_rig.py
```

All 12 scenarios handled correctly (attacks contained, benign controls allowed).
