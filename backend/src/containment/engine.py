"""Containment Engine — Coordinates detectors, composite risk scoring, and verdict generation."""

import uuid
from typing import List, Tuple
from src.containment.detectors.goal_drift import GoalDriftDetector
from src.containment.detectors.rule_based import RuleBasedDetector
from src.containment.detectors.semantic import SemanticDetector
from src.containment.detectors.statistical import StatisticalDetector
from src.containment.scoring.composite import CompositeScorer
from src.core.models.events import SecurityEvent, ToolCallEvent
from src.core.models.scores import ContainmentVerdict, RiskScore


class ContainmentEngine:
    """Core containment evaluation engine."""

    def __init__(self) -> None:
        self.detectors = [
            RuleBasedDetector(),
            StatisticalDetector(),
            SemanticDetector(),
            GoalDriftDetector(),
        ]
        self.scorer = CompositeScorer()

    def evaluate_event(self, event: ToolCallEvent) -> Tuple[RiskScore, ContainmentVerdict, List[SecurityEvent]]:
        """Evaluate incoming tool call event across all detectors and produce score and verdict."""
        security_events: List[SecurityEvent] = []
        for detector in self.detectors:
            sec_evt = detector.detect(event)
            if sec_evt:
                security_events.append(sec_evt)

        risk_score = self.scorer.calculate_score(security_events)
        risk_score.session_id = event.session_id

        # Generate verdict
        if risk_score.overall_score >= 80.0:
            verdict_type = "BREACHED"
            action = "KILL"
            reasoning = f"Critical containment breach detected (Risk Score: {risk_score.overall_score:.1f}). Flags: {risk_score.flags}"

        elif risk_score.overall_score >= 50.0:
            verdict_type = "SUSPICIOUS"
            action = "QUARANTINE"
            reasoning = f"Suspicious activity detected (Risk Score: {risk_score.overall_score:.1f}). Flags: {risk_score.flags}"
        else:
            verdict_type = "SAFE"
            action = "NONE"
            reasoning = "Tool execution evaluated within safe containment parameters."

        verdict = ContainmentVerdict(
            session_id=event.session_id,
            verdict=verdict_type,  # SAFE, SUSPICIOUS, BREACHED, ESCALATED
            confidence=0.95,
            reasoning=reasoning,
            recommended_action=action,  # NONE, ALERT, THROTTLE, KILL, QUARANTINE
        )

        return risk_score, verdict, security_events
