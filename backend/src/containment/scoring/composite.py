"""Composite Scorer Implementation.

WORKPACKAGE B (B3): the previous implementation was a pure MAX of detector
scores — ingest showed ``rule_based/statistical/semantic/goal_drift = 0.0``
while ``overall = 90``, so the headline was not explainable from the
sub-scores. Now the headline is derived from a calibrated weighted combination
of every detector sub-score (the "blend"), floored by the single strongest
signal so a lone critical hit is never diluted below its verdict band, and
raised by a small compounding bonus when multiple strong detectors agree.

    overall = clamp( max(blend, strongest_single) + compounding_bonus, 0, 100 )

Verdict bands are unchanged: >= 80 KILL, >= 50 QUARANTINE, else SAFE.
"""

import uuid

from src.containment.scoring.base import BaseScorer
from src.core.models.events import SecurityEvent
from src.core.models.scores import RiskScore

# Calibrated weights across all detector families (sums to 1.00). Deterministic
# signature detectors (rule, prompt-injection) weight more than statistical
# signals that need corroboration.
SUBSCORE_WEIGHTS: dict[str, float] = {
    "rule_based_score": 0.22,
    "injection_score": 0.14,
    "semantic_score": 0.14,
    "statistical_score": 0.09,
    "goal_drift_score": 0.09,
    "trajectory_score": 0.09,
    "tool_output_score": 0.05,
    "sql_injection_score": 0.05,
    "mcp_destructive_score": 0.03,
    "canary_score": 0.02,
    "policy_score": 0.08,
}

# Detectors whose sub-score counts as "strong" for the compounding bonus.
COMPOUNDING_FLOOR = 60.0
COMPOUNDING_MAX_BONUS = 15.0
COMPOUNDING_PER_DETECTOR = 3.0

# Map SecurityEvent.detector -> RiskScore field name.
_DETECTOR_TO_FIELD = {
    "RuleBasedDetector": "rule_based_score",
    "StatisticalDetector": "statistical_score",
    "SemanticDetector": "semantic_score",
    "GoalDriftDetector": "goal_drift_score",
    "TrajectoryDetector": "trajectory_score",
    "PromptInjectionDetector": "injection_score",
    "ToolOutputScanner": "tool_output_score",
    "CanaryTokenDetector": "canary_score",
    "SqlInjectionDetector": "sql_injection_score",
    "McpDestructiveToolDetector": "mcp_destructive_score",
    "PolicyDetector": "policy_score",
}


class CompositeScorer(BaseScorer):
    """Combines all detector sub-scores into an explainable overall risk index."""

    def calculate_score(self, events: list[SecurityEvent]) -> RiskScore:
        if not events:
            return RiskScore(
                session_id=uuid.uuid4(),
                overall_score=0.0,
                rule_based_score=0.0,
                statistical_score=0.0,
                semantic_score=0.0,
                goal_drift_score=0.0,
                bypass_depth=0,
                flags=[],
            )

        # Per-detector sub-scores (max of events attributed to each detector).
        subscores = {field: 0.0 for field in SUBSCORE_WEIGHTS}
        for event in events:
            field = _DETECTOR_TO_FIELD.get(event.detector)
            if field is not None:
                subscores[field] = max(subscores[field], event.risk_score)

        blend = sum(weight * subscores[field] for field, weight in SUBSCORE_WEIGHTS.items())
        max_single = max(subscores.values())

        # Compounding: multiple strong (>= 60) detectors raise the headline so
        # corroborating signals move the verdict, not just the loudest one.
        strong = [score for score in subscores.values() if score >= COMPOUNDING_FLOOR]
        bonus = 0.0
        if len(strong) >= 2:
            bonus = min(COMPOUNDING_MAX_BONUS, len(strong) * COMPOUNDING_PER_DETECTOR)

        overall = min(100.0, max(blend, max_single) + bonus)
        depth = 3 if overall >= 70.0 else 1 if overall >= 40.0 else 0
        flags = list(dict.fromkeys(e.event_type for e in events))

        session_id = events[0].session_id

        return RiskScore(
            session_id=session_id,
            overall_score=overall,
            rule_based_score=subscores["rule_based_score"],
            statistical_score=subscores["statistical_score"],
            semantic_score=subscores["semantic_score"],
            goal_drift_score=subscores["goal_drift_score"],
            injection_score=subscores["injection_score"],
            trajectory_score=subscores["trajectory_score"],
            tool_output_score=subscores["tool_output_score"],
            canary_score=subscores["canary_score"],
            sql_injection_score=subscores["sql_injection_score"],
            mcp_destructive_score=subscores["mcp_destructive_score"],
            policy_score=subscores["policy_score"],
            bypass_depth=depth,
            flags=flags,
        )
