"""Scoring Service."""


from src.containment.scoring.composite import CompositeScorer
from src.core.models.events import SecurityEvent
from src.core.models.scores import RiskScore


class ScoringService:
    """Service wrapping composite risk scoring engine."""

    def __init__(self) -> None:
        self.scorer = CompositeScorer()

    def score_events(self, events: list[SecurityEvent]) -> RiskScore:
        """Compute composite risk score from security events."""
        return self.scorer.calculate_score(events)
