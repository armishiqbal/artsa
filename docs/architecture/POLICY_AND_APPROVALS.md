# Policies and Approvals

Policies are tenant-scoped and versioned. Explicit deny wins over approval;
approval wins over allow. High-risk GitHub writes become `REQUIRE_APPROVAL`.
An approval is one-time and bound to tenant, action digest, agent, installation,
repository, tool, policy version and expiry. Any changed input requires a new
approval. Expiry, denial, duplicate use, and session mismatch block execution.

Monitor mode records decisions without executing a block. Production rollout is
monitor -> review false positives -> approval for risky writes -> narrowly
scoped blocks. Policy simulation uses retained digests and synthetic fixtures,
never raw customer payloads.
