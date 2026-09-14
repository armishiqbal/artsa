# Evaluation and Claims

Maintain separate development, regression and independent-holdout corpora for
MCP/GitHub malicious and benign actions. Report sample counts, recall,
precision, false-positive rate, unavailable rate and latency with the exact
detector/policy version. Hash embeddings and mocked browser responses are not
semantic performance evidence. Never display no-evaluation as safe or publish a
competitor comparison without running the same independent set.

## Managed GitHub MCP live gate

Run `PYTHONPATH=backend python backend/scripts/managed_mcp_live_gate.py` only
against a disposable, customer-approved GitHub App installation and repository.
It refuses to run unless `ARTSA_LIVE_EVALUATION=1` and all dedicated tenant,
agent, installation, repository and operator-credential variables are present.
It first proves safe-authority, prompt-injection, and cross-repository denial.
`--prepare-approved-issue` creates an approval request but deliberately stops:
an operator must approve the exact bound action and perform the single-use
retry separately. The command prints only the MCP session and approval ID; the
retry credential is supplied through environment variables rather than command
arguments. Run `--execute-approved-issue` with the same session, exact title,
and returned token to prove changed-argument rejection, one successful issue,
and token-reuse rejection. Add `--wait-webhook` when the GitHub App webhook is
configured; the resulting GitHub `issues.opened` webhook must reconcile the
evidence before a real external write is counted as verified.

Provider failure, poisoned output, token-replay and cross-tenant cases remain
in the local regression suite; only a run with a recorded environment, dataset
version, timestamp, commit SHA and result artifact may become a product claim.
