"""Composite Scorer Implementation."""

import uuid
from typing import List
from src.containment.scoring.base import BaseScorer
from src.core.models.events import SecurityEvent
from src.core.models.scores import RiskScore


class CompositeScorer(BaseScorer):
    """Combines rule-based, statistical, semantic, and goal drift scores into overall risk index."""

    def calculate_score(self, events: List[SecurityEvent]) -> RiskScore:
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

        rule_score = max([e.risk_score for e in events if e.detector == "RuleBasedDetector"], default=0.0)
        stat_score = max([e.risk_score for e in events if e.detector == "StatisticalDetector"], default=0.0)
        sem_score = max([e.risk_score for e in events if e.detector == "SemanticDetector"], default=0.0)
        drift_score = max([e.risk_score for e in events if e.detector == "GoalDriftDetector"], default=0.0)
        traj_score = max([e.risk_score for e in events if e.detector == "TrajectoryDetector"], default=0.0)

        overall = min(100.0, max(rule_score, stat_score, sem_score, drift_score, traj_score))
        depth = 3 if overall >= 70.0 else 1 if overall >= 40.0 else 0
        flags = [e.event_type for e in events]

        session_id = events[0].session_id

        return RiskScore(
            session_id=session_id,
            overall_score=overall,
            rule_based_score=rule_score,
            statistical_score=stat_score,
            semantic_score=sem_score,
            goal_drift_score=drift_score,
            bypass_depth=depth,
            flags=flags,
        )
