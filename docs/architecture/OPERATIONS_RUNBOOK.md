# Operations Runbook

Deploy ARTSA, Postgres, Redis, the local ONNX semantic model and GitHub App
credentials inside the customer VPC. Production readiness fails when the local
semantic model is unavailable, authentication is disabled, encryption secrets
are weak, or CORS is unrestricted. Rotate GitHub App keys and ARTSA credentials
through the customer secret manager; never put them in frontend configuration.

Monitor gateway outcomes, detector availability, decision latency, approval
expiry, webhook verification failures, delivery lag, tenant-denial attempts and
GitHub API errors. Preserve Postgres backups and test restore/rollback before
production rollout.
