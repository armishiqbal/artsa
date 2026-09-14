# System Architecture

```text
Agent -> ARTSA MCP gateway -> policy + local detectors -> GitHub MCP adapter -> GitHub Cloud
                    |                       |                     |
                    +-----------------------+---------------------+
                                      digest-only evidence
                                      Postgres + Redis
```

The gateway authenticates the tenant, validates MCP schema, assigns a trace and
action ID, calculates request digests, enriches the action with GitHub App and
repository context, then decides `ALLOW`, `BLOCK`, `REQUIRE_APPROVAL`, or
`UNAVAILABLE`. Only the managed GitHub adapter holds a short-lived installation
token. Postgres stores tenant-scoped inventory, decisions, approvals and
redacted findings; Redis supplies idempotency, replay prevention, TTLs and rate
limits. Customer text never leaves the VPC for semantic evaluation.

The existing stdio boundary remains supported. Streamable HTTP is the production
transport and must reject malformed, incomplete or unauthenticated frames.
