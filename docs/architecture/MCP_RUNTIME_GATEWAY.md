# MCP Runtime Gateway

Every managed action is represented by schema-versioned `ActionRequest` and
`ActionDecision` contracts. `ActionRequest` contains only identifiers,
repository metadata and `arguments_sha256`; raw arguments remain in process and
are never persisted. `ActionDecision` contains the outcome, reason categories,
policy/detector versions, evidence ID, latency and optional expiry.

Gateway order: authenticate tenant -> validate method/tool schema -> enforce
idempotency -> screen untrusted input and tool arguments -> enrich context ->
evaluate policy -> persist digest-only evidence -> allow, block, or create a
bound approval. Missing local semantic capacity produces `UNAVAILABLE`; the
policy decides fail-closed behavior. A closed/incomplete stream is never proof
of a safe action.

## Streamable HTTP boundary

`POST /api/v1/mcp` implements the managed Streamable HTTP entry point. It
accepts JSON-RPC 2.0 `initialize`, `tools/list`, `tools/call`, and
`notifications/cancelled` messages. `initialize` creates a 30-minute
`Mcp-Session-Id`, bound in Redis to a tenant-owned, explicitly registered
agent. Every later request must carry that header. Frames are capped at 256 KiB
and malformed frames, expired sessions, unsupported methods, and arguments
outside the server-enforced tool schema receive JSON-RPC errors before the
gateway sees them.

The v1 catalog is deliberately bounded. A registered agent declares its owner,
purpose, allowed tools, GitHub installations and repositories. ARTSA rejects a
call outside those exact authority bindings. The issue-create path routes via
the approval-gated execution coordinator; no arbitrary URL, credential, or
GitHub API method is accepted.

Bounded GitHub reads also route through that coordinator: an `ALLOW` decision
is followed by a least-privilege installation-token call and an output scan.
The screened result is returned only to the authenticated MCP client. Evidence
retains its digest, outcome, latency and redacted categories—not repository
content or the GitHub response.
