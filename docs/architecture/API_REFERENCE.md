# API Reference

`ActionRequest` and `ActionDecision` are versioned Pydantic contracts in
`src.mcp.contracts`. `POST /mcp/actions/evaluate` is the current pre-execution
decision endpoint for ARTSA-managed GitHub actions. It authenticates the tenant,
derives the argument digest server-side, and returns only a correlated,
redaction-safe `ActionDecision`. It never forwards a call or exposes GitHub
credentials.

The request is idempotent per tenant and `actionId`. Its required authority
scope includes the GitHub installation, repository resource, tool, action
digest, and policy version. The v1 catalog permits bounded reads; creates for a
branch, pull request, issue, or issue comment return `REQUIRE_APPROVAL` and an
approval is bound to that complete scope. All other GitHub tools return `BLOCK`.
Production evaluations return `UNAVAILABLE` when the approved local semantic
model cannot be loaded; they do not fall back to hash embeddings or claim safe.

`POST /mcp` is the managed Streamable HTTP MCP endpoint. It supports
JSON-RPC 2.0 `initialize`, `tools/list`, `tools/call`, and cancellation
notification. `initialize` requires a tenant-owned registered agent and
returns an `Mcp-Session-Id`; all calls are then restricted to the agent's
declared tools, GitHub installations and repositories. Frames over 256 KiB,
invalid sessions and fields outside a tool schema fail before evaluation.

The GitHub App adapter currently implements only the approval-gated
issue-creation path; all other writes remain decision-only and are not
execution claims.

Bounded v1 read tools execute after `ALLOW` through the same managed GitHub
adapter and output gate. Their raw response remains in process and is returned
only in the authenticated MCP `tools/call` response; it is not present in
operator evidence, telemetry or logs.

`POST /mcp/actions/execute` is the managed v1 execution route. It supports
only `github_create_issue`, requires a newly generated action ID and a
single-use approval retry token, then screens GitHub's untrusted result before
returning it to the MCP caller. The evidence record retains only execution
state, digest, latency, approval linkage, and redacted categories; the raw
GitHub payload is never persisted or exposed in the operator UI.

Outbound security webhooks use a versioned event envelope, delivery UUID,
timestamp and HMAC-SHA256 signature. Receivers must verify the signature and
deduplicate the delivery ID. State-changing APIs require an idempotency key.
