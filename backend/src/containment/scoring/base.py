"""Base Scorer Abstract Class."""

from abc import ABC, abstractmethod
from typing import List
from src.core.models.events import SecurityEvent
from src.core.models.scores import RiskScore


class BaseScorer(ABC):
    """Abstract base class for risk scoring engine."""

    @abstractmethod
    def calculate_score(self, events: List[SecurityEvent]) -> RiskScore:
        """Calculate overall risk score from list of security events."""
        pass
