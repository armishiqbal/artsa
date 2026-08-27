"""Realtime Monitor Implementation."""

import logging

from src.containment.engine import ContainmentEngine
from src.core.models.events import SecurityEvent, ToolCallEvent
from src.core.models.scores import ContainmentVerdict, RiskScore

logger = logging.getLogger(__name__)


class RealtimeMonitor:
    """Monitors live tool execution streams in real-time."""

    # Prompt / chat scans: injection + goal drift + policy only (sub‑50ms path).
    _FAST_PROMPT_KEEP = frozenset(
        {
            "PromptInjectionDetector",
            "GoalDriftDetector",
            "PolicyDetector",
        }
    )

    def __init__(self) -> None:
        self.engine = ContainmentEngine()
        disabled = [
            name for name in ContainmentEngine.DETECTOR_NAMES if name not in self._FAST_PROMPT_KEEP
        ]
        self.fast_engine = ContainmentEngine(disabled_detectors=disabled)

    def process_event(self, event: ToolCallEvent) -> tuple[RiskScore, ContainmentVerdict, list[SecurityEvent]]:
        """Process event and return risk evaluation."""
        return self.engine.evaluate_event(event)

    def process_event_fast(
        self, event: ToolCallEvent
    ) -> tuple[RiskScore, ContainmentVerdict, list[SecurityEvent]]:
        """Lightweight evaluation for live prompt/output monitoring."""
        return self.fast_engine.evaluate_event(event)
