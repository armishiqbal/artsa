"""Containment Engine — Coordinates detectors, composite risk scoring, and verdict generation."""

import json

from src.containment.detectors.canary_token import CanaryTokenDetector
from src.containment.detectors.goal_drift import GoalDriftDetector
from src.containment.detectors.mcp_destructive import McpDestructiveToolDetector
from src.containment.detectors.prompt_injection import PromptInjectionDetector
from src.containment.detectors.rule_based import RuleBasedDetector
from src.containment.detectors.semantic import SemanticDetector
from src.containment.detectors.sql_injection import SqlInjectionDetector
from src.containment.detectors.statistical import StatisticalDetector
from src.containment.detectors.tool_output_scanner import ToolOutputScanner
from src.containment.detectors.trajectory import TrajectoryDetector
from src.containment.scoring.composite import CompositeScorer
from src.core.models.events import SecurityEvent, ToolCallEvent
from src.core.models.scores import ContainmentVerdict, RiskScore
from src.core.severity import CRITICAL_RISK_THRESHOLD, SUSPICIOUS_RISK_THRESHOLD


class ContainmentEngine:
    """Core containment evaluation engine."""

    DETECTOR_NAMES = (
        "RuleBasedDetector",
        "StatisticalDetector",
        "SemanticDetector",
        "GoalDriftDetector",
        "TrajectoryDetector",
        "CanaryTokenDetector",
        "ToolOutputScanner",
        "PromptInjectionDetector",
        "SqlInjectionDetector",
        "McpDestructiveToolDetector",
    )

    def __init__(self, disabled_detectors: list[str] | None = None) -> None:
        disabled = set(disabled_detectors or [])
        all_detectors = [
            RuleBasedDetector(),
            StatisticalDetector(),
            SemanticDetector(),
            GoalDriftDetector(),
            TrajectoryDetector(),
            CanaryTokenDetector(),
            ToolOutputScanner(),
            PromptInjectionDetector(tool_scope=True),
            SqlInjectionDetector(),
            McpDestructiveToolDetector(),
        ]
        self.detectors = [d for d in all_detectors if d.name not in disabled]
        self.scorer = CompositeScorer()
        self.disabled_detectors = list(disabled)

    def _calibrate_confidence(self, risk_score: RiskScore, security_events: list[SecurityEvent]) -> float:
        """Derive confidence from the strongest signal magnitude and detector agreement.

        WORKPACKAGE B (B5): confidence now tracks the strongest detector's score
        (not the blended overall) so a lone critical hit reports high confidence
        even when corroborating detectors are quiet. SAFE (no signals) reports
        high confidence in safety.
        """
        if not security_events:
            return 0.95
        detector_count = len({e.detector for e in security_events})
        top_score = max(e.risk_score for e in security_events)
        score_factor = top_score / 100.0
        agreement_boost = min(0.15, detector_count * 0.03)
        confidence = min(0.99, max(0.50, score_factor * 0.8 + agreement_boost + 0.12))
        return round(confidence, 3)

    def evaluate_event(self, event: ToolCallEvent) -> tuple[RiskScore, ContainmentVerdict, list[SecurityEvent]]:
        """Evaluate incoming tool call event across all detectors and produce score and verdict."""
        risk_score, verdict, security_events, _ = self.evaluate_with_attribution(event)
        return risk_score, verdict, security_events

    def evaluate_with_attribution(
        self, event: ToolCallEvent
    ) -> tuple[RiskScore, ContainmentVerdict, list[SecurityEvent], dict[str, bool]]:
        security_events: list[SecurityEvent] = []
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
        self, event: ToolCallEvent, risk_score: RiskScore, security_events: list[SecurityEvent]
    ) -> ContainmentVerdict:
        # WORKPACKAGE B (B5): name the deciding detector and surface its matched
        # evidence so operators see *why* a verdict was reached, not just a score.
        deciding = max(security_events, key=lambda e: e.risk_score) if security_events else None
        if deciding is not None:
            try:
                evidence_str = json.dumps(deciding.evidence, default=str)[:400]
            except (TypeError, ValueError):
                evidence_str = str(deciding.evidence)[:400]
            evidence_detail = (
                f"Deciding detector: {deciding.detector} "
                f"({deciding.event_type}, severity={deciding.severity}, score={deciding.risk_score:.1f}). "
                f"{deciding.description} Evidence: {evidence_str}."
            )
        else:
            evidence_detail = "No security signals detected."

        if risk_score.overall_score >= CRITICAL_RISK_THRESHOLD:
            verdict_type = "BREACHED"
            action = "KILL"
            reasoning = (
                f"Critical containment breach detected (Risk Score: {risk_score.overall_score:.1f}). "
                f"{evidence_detail} Flags: {risk_score.flags}"
            )
        elif risk_score.overall_score >= SUSPICIOUS_RISK_THRESHOLD:
            verdict_type = "SUSPICIOUS"
            action = "QUARANTINE"
            reasoning = (
                f"Suspicious activity detected (Risk Score: {risk_score.overall_score:.1f}). "
                f"{evidence_detail} Flags: {risk_score.flags}"
            )
        else:
            verdict_type = "SAFE"
            action = "NONE"
            reasoning = (
                "Tool execution evaluated within safe containment parameters "
                f"(Risk Score: {risk_score.overall_score:.1f}). {evidence_detail}"
            )

        return ContainmentVerdict(
            session_id=event.session_id,
            verdict=verdict_type,
            confidence=self._calibrate_confidence(risk_score, security_events),
            reasoning=reasoning,
            recommended_action=action,
        )
