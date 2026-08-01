"""Event Processor Service with route to containment engine and session metrics updater."""

import uuid
import logging
from typing import List, Tuple
from src.containment.monitor import RealtimeMonitor
from src.core.models.events import ToolCallEvent, SecurityEvent
from src.core.models.scores import RiskScore, ContainmentVerdict

logger = logging.getLogger(__name__)


class EventProcessor:
    """Processes tool call events and updates session containment metrics."""

    def __init__(self) -> None:
        self.monitor = RealtimeMonitor()

    def process_event(self, event: ToolCallEvent) -> Tuple[RiskScore, ContainmentVerdict, List[SecurityEvent]]:
        """Route tool call event to containment evaluation engine."""
        return self.monitor.process_event(event)

    def process(self, event: ToolCallEvent) -> Tuple[RiskScore, ContainmentVerdict, List[SecurityEvent]]:
        """Alias for process_event."""
        return self.process_event(event)

    def update_session_metrics(self, session_id: uuid.UUID, risk_score: float) -> None:
        """Update active session risk score metrics."""
        logger.info("Updated metrics for session %s with risk score %.1f", session_id, risk_score)
