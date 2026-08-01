"""Event Processor Service."""

import logging
from typing import Dict, Any, List, Tuple
from src.containment.monitor import RealtimeMonitor
from src.core.models.events import ToolCallEvent, SecurityEvent
from src.core.models.scores import RiskScore, ContainmentVerdict

logger = logging.getLogger(__name__)


class EventProcessor:
    """Processes incoming tool call streams, executes detectors, and produces risk evaluation."""

    def __init__(self) -> None:
        self.monitor = RealtimeMonitor()

    def process(self, event: ToolCallEvent) -> Tuple[RiskScore, ContainmentVerdict, List[SecurityEvent]]:
        """Process event and return containment risk evaluation."""
        logger.info("Processing tool call event %s for agent %s", event.id, event.agent_id)
        return self.monitor.process_event(event)
