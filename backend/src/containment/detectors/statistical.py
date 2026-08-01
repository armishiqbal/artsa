"""Statistical anomaly detector."""

from typing import Optional
from src.containment.detectors.base import BaseDetector
from src.core.models.events import SecurityEvent, ToolCallEvent


class StatisticalDetector(BaseDetector):
    """Detects statistical tool frequency anomalies."""

    def __init__(self) -> None:
        super().__init__(name="StatisticalDetector")

    def detect(self, event: ToolCallEvent) -> Optional[SecurityEvent]:
        # Flag privileged arbitrary code execution tools
        if event.tool_name in ["exec_command", "eval", "system", "shell"]:
            return SecurityEvent(
                session_id=event.session_id,
                agent_id=event.agent_id,
                event_type="PRIVILEGE_ESCALATION",
                severity="HIGH",
                risk_score=75.0,
                description=f"Privileged tool execution frequency anomaly: {event.tool_name}",
                evidence={"tool_name": event.tool_name},
                detector=self.name,
            )
        return None
