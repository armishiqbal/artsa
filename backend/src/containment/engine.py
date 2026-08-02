"""Containment Engine — Coordinates detectors, composite risk scoring, and verdict generation."""

import uuid
from typing import List, Tuple

from src.containment.detectors.goal_drift import GoalDriftDetector
from src.containment.detectors.rule_based import RuleBasedDetector
from src.containment.detectors.semantic import SemanticDetector
from src.containment.detectors.statistical import StatisticalDetector
from src.containment.detectors.trajectory import TrajectoryDetector
from src.containment.scoring.composite import CompositeScorer
from src.core.models.events import SecurityEvent, ToolCallEvent
from src.core.models.scores import ContainmentVerdict, RiskScore


class ContainmentEngine:
    """Core containment evaluation engine."""

    DETECTOR_NAMES = (
        "RuleBasedDetector",
        "StatisticalDetector",
        "SemanticDetector",
        "GoalDriftDetector",
        "TrajectoryDetector",
    )

    def __init__(self, disabled_detectors: list[str] | None = None) -> None:
        disabled = set(disabled_detectors or [])
        all_detectors = [
            RuleBasedDetector(),
            StatisticalDetector(),
            SemanticDetector(),
            GoalDriftDetector(),
            TrajectoryDetector(),
        ]
        self.detectors = [d for d in all_detectors if d.name not in disabled]
        self.scorer = CompositeScorer()
        self.disabled_detectors = list(disabled)

    def _calibrate_confidence(self, risk_score: RiskScore, security_events: List[SecurityEvent]) -> float:
        """Derive confidence from score magnitude and multi-detector agreement."""
        if not security_events:
            return 0.98
        detector_count = len({e.detector for e in security_events})
        score_factor = risk_score.overall_score / 100.0
        agreement_boost = min(0.12, detector_count * 0.03)
        confidence = min(0.99, max(0.55, score_factor * 0.85 + agreement_boost + 0.1))
        return round(confidence, 3)

    def evaluate_event(self, event: ToolCallEvent) -> Tuple[RiskScore, ContainmentVerdict, List[SecurityEvent]]:
        """Evaluate incoming tool call event across all detectors and produce score and verdict."""
        risk_score, verdict, security_events, _ = self.evaluate_with_attribution(event)
        return risk_score, verdict, security_events

    def evaluate_with_attribution(
        self, event: ToolCallEvent
    ) -> Tuple[RiskScore, ContainmentVerdict, List[SecurityEvent], dict[str, bool]]:
        security_events: List[SecurityEvent] = []
        fired: dict[str, bool] = {name: False for name in self.DETECTOR_NAMES}

        for detector in self.detectors:
            sec_evt = detector.detect(event)
            if sec_evt:
                security_events.append(sec_evt)
                fired[detector.name] = True

        risk_score = self.scorer.calculate_score(security_events)
        risk_score.session_id = event.session_id
        verdict = self._build_verdict(event, risk_score, security_events)
        return risk_score, verdict, security_events, fired

    def _build_verdict(
        self, event: ToolCallEvent, risk_score: RiskScore, security_events: List[SecurityEvent]
    ) -> ContainmentVerdict:
        if risk_score.overall_score >= 80.0:
            verdict_type = "BREACHED"
            action = "KILL"
            reasoning = (
                f"Critical containment breach detected (Risk Score: {risk_score.overall_score:.1f}). "
                f"Flags: {risk_score.flags}"
            )
        elif risk_score.overall_score >= 50.0:
            verdict_type = "SUSPICIOUS"
            action = "QUARANTINE"
            reasoning = (
                f"Suspicious activity detected (Risk Score: {risk_score.overall_score:.1f}). "
                f"Flags: {risk_score.flags}"
            )
        else:
            verdict_type = "SAFE"
            action = "NONE"
            reasoning = "Tool execution evaluated within safe containment parameters."

        return ContainmentVerdict(
            session_id=event.session_id,
            verdict=verdict_type,
            confidence=self._calibrate_confidence(risk_score, security_events),
            reasoning=reasoning,
            recommended_action=action,
        )
