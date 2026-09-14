# Security Threat Model

Primary threats: direct and indirect prompt injection, poisoned tool output,
confused-deputy GitHub actions, excessive App permissions, GitHub token theft,
SSRF, webhook replay, cross-tenant IDOR, malicious dependencies and approval
replay. Controls include local detectors, typed tool schemas, least-privilege
GitHub App scopes, signed webhooks, DNS-aware egress restrictions, tenant-bound
authorization, idempotency/replay keys, digest-only logs, and fail-closed
unavailable handling.

ARTSA is a control, not a replacement for GitHub branch protection, SSO, MFA,
network controls, secret scanning, or customer incident response.
