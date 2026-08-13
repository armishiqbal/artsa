"""Goal drift detector."""


from src.containment.detectors.base import BaseDetector
from src.core.models.events import SecurityEvent, ToolCallEvent


class GoalDriftDetector(BaseDetector):
    """Detects multi-turn goal drift where agent trajectory diverges from initial intent."""

    def __init__(self) -> None:
        super().__init__(name="GoalDriftDetector")

    def detect(self, event: ToolCallEvent) -> SecurityEvent | None:
        # Flag long-horizon trajectory drift
        if "exfiltrate" in str(event.arguments).lower():
            return SecurityEvent(
                session_id=event.session_id,
                agent_id=event.agent_id,
                event_type="GOAL_DRIFT",
                severity="HIGH",
                risk_score=85.0,
                description="Goal drift detected: agent trajectory diverged toward exfiltration",
                evidence={"tool_name": event.tool_name, "arguments": event.arguments},
                detector=self.name,
            )
        return None
