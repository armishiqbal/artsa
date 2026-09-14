# GitHub Cloud Connector

Version 1 uses a GitHub App, installed by a tenant administrator with the
smallest repository permissions needed. The adapter is ARTSA-managed, so agents
cannot bypass policy using their own arbitrary GitHub MCP server.

Supported tools: bounded repository reads and approval-gated issue creation.
Branch creation, pull requests and issue comments are recognized policy names
only; they have no v1 execution handler and therefore cannot produce a GitHub
side effect. Every executable write requires a fresh approval.
Excluded tools: repository deletion, organization administration, secrets,
workflow changes, token administration and permission changes.

## Disposable live-evaluation App

Create a private GitHub App for the disposable evaluation account/repository. Request
only the repository permissions required by the exact test catalog:

The reviewable manifest is [GITHUB_APP_MANIFEST.json](./GITHUB_APP_MANIFEST.json).
Use it as the registration checklist, then install the App only on the private
`haroonsh-dev/artsa-live-evaluation` repository. GitHub generates the App ID,
private key, webhook secret, and installation ID; place those values in the
customer-VPC secret manager rather than committing them.

| Permission | Level | Used for |
|---|---|---|
| Metadata | Read-only | installation/repository inventory and repository identity |
| Contents | Read-only | `github_get_file_contents` |
| Issues | Read & write | issue reads and the v1 `github_create_issue` write |
| Pull requests | Read-only | pull-request reads |

Subscribe only to `installation`, `installation_repositories`, and `issues`
webhooks. Do not grant administration, Actions/workflows, secrets, members,
organization, or repository-delete permissions. Restrict the installation to
one disposable repository when creating the live token. ARTSA's adapter then
requests the same repository restriction and only the permission needed by the
specific operation. A missing permission must result in a truthful failure,
not a fallback to a broader credential.

Before the first run, enroll the installation in the isolated ARTSA tenant,
register an agent whose allowed installation/repository/tool lists contain only
that test resource, and verify `/ready` reports a warmed `ok:local-*` semantic
model. Never use a developer's personal access token for this proof.

GitHub webhook deliveries require HMAC signature verification, delivery-ID
deduplication and correlation to ARTSA action/trace IDs. Installation tokens are
short-lived, held only in memory/Redis, and never exposed to UI or evidence.

For every single-repository action, ARTSA requests a GitHub installation token
scoped to that repository and to the minimum permission needed for the selected
tool. The inventory-list operation is the sole exception because it must read
the installation's repository list. ARTSA never assumes a fixed token format or
length; GitHub controls its opaque token representation.
