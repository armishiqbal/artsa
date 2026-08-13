"""Event Processor Service with route to containment engine and session metrics updater."""

import logging
import uuid

from src.containment.monitor import RealtimeMonitor
from src.core.models.events import SecurityEvent, ToolCallEvent
from src.core.models.scores import ContainmentVerdict, RiskScore

logger = logging.getLogger(__name__)


class EventProcessor:
    """Processes tool call events and updates session containment metrics."""

    def __init__(self) -> None:
        self.monitor = RealtimeMonitor()

    def process_event(self, event: ToolCallEvent) -> tuple[RiskScore, ContainmentVerdict, list[SecurityEvent]]:
        """Route tool call event to containment evaluation engine."""
        return self.monitor.process_event(event)

    def process(self, event: ToolCallEvent) -> tuple[RiskScore, ContainmentVerdict, list[SecurityEvent]]:
        """Alias for process_event."""
        return self.process_event(event)

    def update_session_metrics(self, session_id: uuid.UUID, risk_score: float) -> None:
        """Update active session risk score metrics."""
        logger.info("Updated metrics for session %s with risk score %.1f", session_id, risk_score)
