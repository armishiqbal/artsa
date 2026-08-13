# ADR-001: Hybrid Detector Architecture (Regex + Semantic)

**Status:** Accepted  
**Date:** 2026-08-11  
**Deciders:** ARTSA Platform Security Team

## Context

The containment engine must evaluate every tool call in real time with sub-millisecond
latency to avoid degrading agent performance. Initial prototypes used only LLM-based
semantic classifiers, which introduced 200–800 ms of latency per evaluation.

We needed a defense-in-depth architecture that balances speed, accuracy, and
cost-effectiveness.

## Decision

Adopt a **tiered hybrid architecture** with three detection layers:

1. **Tier 1 — Deterministic Regex (fast path):** `PromptInjectionDetector`,
   `RuleBasedDetector`, `CanaryTokenDetector`, `ToolOutputScanner`. Each operates
   in <1 ms and covers well-defined attack signatures (jailbreak patterns, credential
   leaks, canary tokens, shell escapes).

2. **Tier 2 — Statistical / Pattern-based:** `StatisticalDetector`,
   `TrajectoryDetector`, `GoalDriftDetector`. Heuristic analysis of tool-call
   sequences, argument entropy, and session behaviour. ~5–15 ms per evaluation.

3. **Tier 3 — Semantic / ML (slow path):** `SemanticDetector`. LLM-based
   classification for ambiguous cases where deterministic rules are insufficient.
   Only invoked when Tier 1 and 2 produce a borderline score (50–80 range).
   ~200–500 ms per evaluation, but invoked selectively.

The `CompositeScorer` aggregates signals from all tiers to produce a final
`RiskScore` and `ContainmentVerdict`.

## Consequences

- **Positive:** Sub-millisecond average evaluation time for 95% of tool calls.
- **Positive:** New attack patterns can be added as regex rules without ML retraining.
- **Positive:** Tier 3 is invoked sparingly, controlling LLM API costs.
- **Negative:** Regex patterns require maintenance as attack techniques evolve.
- **Negative:** False positives on Tier 1 may block legitimate edge cases (mitigated
  by the composite scorer requiring multi-detector agreement for CRITICAL verdicts).

## Detector Registry (as of 2026-08-11)

| Detector | Tier | Latency | Domain |
|---|---|---|---|
| `CanaryTokenDetector` | 1 | <1 ms | Deception token triggers |
| `ToolOutputScanner` | 1 | <1 ms | Sensitive data exposure in outputs |
| `PromptInjectionDetector` | 1 | <1 ms | Jailbreak / system prompt extraction |
| `RuleBasedDetector` | 1 | <1 ms | Shell commands, file access, egress |
| `StatisticalDetector` | 2 | ~5 ms | Argument entropy, sequence anomalies |
| `TrajectoryDetector` | 2 | ~10 ms | Tool-call path deviation |
| `GoalDriftDetector` | 2 | ~8 ms | Mission drift from declared goal |
| `SemanticDetector` | 3 | ~200 ms | Ambiguous LLM classification |
