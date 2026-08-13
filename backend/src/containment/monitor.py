"""Realtime Monitor Implementation."""

import logging

from src.containment.engine import ContainmentEngine
from src.core.models.events import SecurityEvent, ToolCallEvent
from src.core.models.scores import ContainmentVerdict, RiskScore

logger = logging.getLogger(__name__)


class RealtimeMonitor:
    """Monitors live tool execution streams in real-time."""

    def __init__(self) -> None:
        self.engine = ContainmentEngine()

    def process_event(self, event: ToolCallEvent) -> tuple[RiskScore, ContainmentVerdict, list[SecurityEvent]]:
        """Process event and return risk evaluation."""
        return self.engine.evaluate_event(event)
