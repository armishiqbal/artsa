# Evidence and Privacy

Default evidence is digest-only: action/session/trace IDs, tenant, agent, tool,
repository, action digest, outcome, policy and detector versions, latency,
timestamp, redacted finding categories and approval linkage. ARTSA does not
persist prompts, raw tool arguments, model output, GitHub tokens, matched secret
text, or canary plaintext.

Every read/write query is tenant scoped. Evidence is append-only; retention is
configured by the customer VPC operator. Encrypted full-payload replay is not a
v1 feature and requires a separate privacy review and explicit customer opt-in.
