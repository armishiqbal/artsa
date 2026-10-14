# ADR-008: Campaign execution and telemetry reflect the six-agent flow

**Status:** Accepted  
**Date:** 2026-10-08  
**Supersedes:** the unwired-role and three-hop claims in ADR-007

## Context

`CampaignManager.run` executes Research, Curator, Red Team, Target, and Judge for each completed round. Defender executes only when the scored result meets the mitigation threshold. The campaign event bus and Command Center contract still described Research, Curator, and Defender as unwired, so observed campaign execution and reported agent state disagreed.

Research kickoff was also signed as if Defender had initiated it, even when no Defender hop had occurred.

## Decision

- The Campaign Manager is the trusted signer for the initial Research kickoff; it is not presented as an agent in the six-agent chain.
- Each downstream agent verifies its incoming signed handoff before processing. The dashboard reports per-receiver verification state from the round evidence.
- Completed rounds mark Research, Curator, Red Team, Target, and Judge as executed. Defender is marked executed only when its Judge-to-Defender handoff is present.
- Campaign status events preserve the latest observed agent stages rather than marking every agent running or done based only on campaign status.
- Development may use the existing in-memory Redis fallback. That fallback is not cross-process replay protection. Production remains fail-closed when live Redis is unavailable.

## Consequences

The live campaign chain and telemetry now agree, including conditional Defender execution. HMAC health remains unverified until a campaign records receiver-verification evidence. Local API health alone does not prove the campaign chain ran. Provider-backed assessment still requires a registered, authorized target and successful provider configuration.
