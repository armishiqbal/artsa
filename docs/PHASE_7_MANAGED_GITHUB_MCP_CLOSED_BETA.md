# Phase 7 — Managed GitHub MCP Closed Beta

## Outcome

Validate ARTSA as a customer-VPC control plane for one bounded workflow: a
registered agent performs repository reads and can create a GitHub issue only
after a human approves the exact action. Completion requires a successful
disposable-repository live gate, monitor- and approval-mode operation, and a
truthful pilot report.

This is a deployment-and-evidence phase. It makes no claim of broad GitHub
automation, autonomous remediation, general model accuracy, or full-payload
forensics.

## Fixed beta boundary

| In scope | Explicitly out of scope |
|---|---|
| One tenant, agent, GitHub App installation, and disposable repository | Personal access tokens, arbitrary GitHub MCP servers, shared credentials |
| Bounded reads such as `github_get_file_contents` | Deletion, administration, secrets, workflows, permission or organization changes |
| `github_create_issue` after fresh, single-use approval | Branch, pull-request, comment, and other write execution |
| Customer-VPC API, Postgres, Redis, local semantic model, dashboard, metrics | Raw prompt/response retention and production penetration testing |

## Delivery sequence

```text
P7.0 release evidence → P7.1 secure environment → P7.2 GitHub trust setup
      → P7.3 live gate → P7.4 monitor mode → P7.5 approval UX
      → P7.6 scoped enforcement → P7.7 pilot report and exit decision
```

No package may enable enforcement until the preceding package meets its exit
criteria. Missing approved local semantic capacity returns `UNAVAILABLE`; it
is never interpreted as safe.

The current P7.0 gate record is maintained in
[Phase 7 P7.0 Release Evidence](PHASE_7_P0_RELEASE_EVIDENCE.md).

## Work packages

### P7.0 — Release evidence and ownership

**Owners:** Product and release engineering

- Freeze the beta commit, detector/policy versions, migration revision, local
  model identifier, and deployment-manifest digest.
- Assign an operator, security approver, on-call owner, rollback owner, and
  approval-response SLO.
- Run backend, SDK, frontend, migration, and regression suites in the release
  candidate. Resolve or formally quarantine any collection dependency gap.

**Acceptance criteria**

- A release artifact records every frozen version and reproducible CI result.
- Every suite passes or has a documented, approved, time-bounded exception.
- Launch copy makes only the fixed-beta-boundary claims.

### P7.1 — Customer-VPC production readiness

**Owners:** DevOps and security

- Deploy API, Postgres, Redis, and the approved local semantic model in a
  non-public VPC segment.
- Use the secret manager for ARTSA, GitHub App, encryption, and webhook secrets;
  rotate a non-production credential to prove the procedure.
- Require authentication, explicit CORS origins, TLS, tenant-bound authorization,
  and MCP-client network allow-listing.
- Configure backups, restore target, Prometheus, structured logs, and alerts for
  readiness, semantic availability, latency, approval expiry, GitHub failures,
  webhook verification failures, and tenant denials.

**Acceptance criteria**

- `/health`, `/ready`, and metrics follow the intended operational access path;
  `/ready` fails if the semantic model is unavailable.
- Secrets are absent from source, frontend configuration, evidence, logs, and
  shell history.
- A staging Postgres restore and API rollback are recorded with duration and
  owner.

### P7.2 — GitHub App trust setup

**Owners:** Tenant administrator and security reviewer

- Create a private GitHub App from the reviewed manifest; install it only on
  the disposable evaluation repository.
- Grant Metadata read, Contents read, Issues read/write, and Pull Requests read
  only. Subscribe only to installation and issues webhooks.
- Keep the App ID, private key, webhook secret, and installation ID in the VPC
  secret manager. Never use a personal access token.
- Enroll the installation and register an agent with exact tool, installation,
  repository, and purpose bindings.

**Acceptance criteria**

- Permission review verifies no administration, Actions, workflows, secrets,
  membership, organization, or deletion capability.
- Invalid tenant, agent, installation, repository, and tool combinations are
  denied before requesting a GitHub token.
- Replayed webhooks are deduplicated and invalid HMAC signatures are rejected.

### P7.3 — Managed MCP and GitHub live gate

**Owners:** Integration engineering and security

- Run `backend/scripts/managed_mcp_live_gate.py` only against the authorized
  disposable installation and with its explicit live-evaluation flag.
- Prove Streamable HTTP session creation, declared-tool enforcement, schema and
  frame-size rejection, idempotency, and session expiry.
- Prove a bounded read only works inside the registered repository.
- Prepare an approval, then execute the exact approved issue creation separately.
  Prove changed-argument rejection, one successful create, retry-token reuse
  rejection, and evidence reconciliation from the signed `issues.opened` webhook.

**Acceptance criteria**

- The live-gate artifact records timestamp, commit SHA, redacted tenant/repository
  identifiers, policy/detector versions, and pass/fail results.
- Cross-repository access, prompt injection, malformed frames, expired sessions,
  approval mismatch, duplicate approval use, and webhook replay fail safely.
- Artifacts and operator evidence contain no raw arguments, repository content,
  token, or issue body.

### P7.4 — Monitor-mode evidence collection

**Owners:** Security operations and data engineering

- Run authorized representative traffic in monitor mode for an agreed window;
  record proposed decisions without enforcement side effects.
- Publish daily digest-only metrics by policy/detector version: decision count,
  `UNAVAILABLE` rate, latency percentiles, suspected false positives, approval
  candidates, tenant denials, and webhook lag.
- Disposition every proposed block or approval: correct, false positive, expected
  restriction, or needs investigation.
- Alert on significant changes in verdict mix, availability, latency, and
  detector-layer contribution. Do not infer general model quality from pilot size.

**Acceptance criteria**

- Every monitor decision is traceable to digest-only evidence and version data.
- Operators can explain high-severity decisions without retained payloads.
- No critical false positive or unexplained increase in unavailability, webhook
  failure, or cross-tenant denial remains unresolved.

### P7.5 — Human approval workflow

**Owners:** Product, UI/UX, and security operations

- Provide an approval inbox with action, tenant, agent, repository, tool, policy
  version, risk categories, expiry, and bound scope.
- Provide approve, deny, expired, and already-used states with audit-safe feedback;
  changed context always requires fresh approval.
- Support keyboard navigation, visible focus, loading/error states, color-independent
  severity, and responsive layout. Track approval turnaround and expiry rates.

**Acceptance criteria**

- Approval cannot transfer across tenant, agent, installation, repository, tool,
  policy version, action digest, or session.
- Changed arguments, expiry, denial, and retry-token reuse are denied before GitHub.
- The UI explains the approval requirement without showing raw sensitive data.

### P7.6 — Scoped enforcement

**Owners:** Security approver and on-call engineer

- Enable only policies validated during monitor mode; keep reads authority-bound
  and all executable issue creation approval-gated.
- Start with a small agent cohort and maintain a fast rollback to monitor mode.
- Test local-model, Redis, GitHub API, webhook-delay, and timeout failures. Their
  behavior must match the approved fail-closed policy.

**Acceptance criteria**

- Unauthorized or contained actions never reach GitHub.
- Every real write has a current, exact, single-use approval and signed-webhook
  evidence reconciliation.
- A rollback-to-monitor rehearsal causes neither data loss nor broader permission.

### P7.7 — Pilot report and exit decision

**Owners:** Product, data engineering, and security leadership

- Publish a time-bounded digest-only report: sample count, versions, outcomes,
  approval turnaround, false-positive dispositions, unavailability, latency,
  webhook lag, incidents, and residual risks.
- Separate development/regression evidence from the live pilot and make only
  measured claims.
- Conduct a blameless review: extend beta, remediate a named gap, or roll back.
  Tool-catalog expansion requires a new approved scope.

**Acceptance criteria**

- The report reproduces from retained digest-only evidence and release artifacts.
- It contains no unsupported accuracy, competitor, or autonomous-remediation claim.
- Security leadership signs the exit decision and any next-scope proposal.

## Scorecard

| Signal | Required interpretation |
|---|---|
| Managed MCP live gate | Pass before making an external-write claim. |
| Local semantic availability | Measure inability to load it as `UNAVAILABLE`, never safe. |
| Authorization failures | Break down tenant, agent, installation, repository, tool, session, and approval-binding failures. |
| Approval health | Track created, approved, denied, expired, mismatched, consumed, and turnaround time. |
| Safety and availability | Review false positives, blocked unsafe actions, latency, GitHub/webhook errors, and rollback time. |
| Evidence privacy | Verify raw payloads, tokens, repository responses, and secrets never enter evidence, logs, or UI. |

## Required external operator actions

These cannot be completed through a repository change and require authorized
operators:

1. Register and install the private GitHub App on the disposable repository.
2. Configure VPC secrets, networking, TLS, monitoring, backups, and webhooks.
3. Approve the exact live-gate issue and authorize monitor/enforcement windows.

## References

- [Product vision](architecture/PRODUCT_VISION.md)
- [MCP runtime gateway](architecture/MCP_RUNTIME_GATEWAY.md)
- [GitHub connector](architecture/GITHUB_CONNECTOR.md)
- [Policy and approvals](architecture/POLICY_AND_APPROVALS.md)
- [Evidence and privacy](architecture/EVIDENCE_AND_PRIVACY.md)
- [Evaluation and claims](architecture/EVALUATION_AND_CLAIMS.md)
- [Operations runbook](architecture/OPERATIONS_RUNBOOK.md)
