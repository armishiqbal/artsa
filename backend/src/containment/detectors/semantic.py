"""Semantic prompt injection detector."""

from typing import Optional
from src.containment.detectors.base import BaseDetector
from src.core.models.events import SecurityEvent, ToolCallEvent


class SemanticDetector(BaseDetector):
    """Detects prompt injection and jailbreak semantics in tool arguments."""

    def __init__(self) -> None:
        super().__init__(name="SemanticDetector")

    def detect(self, event: ToolCallEvent) -> Optional[SecurityEvent]:
        arg_str = str(event.arguments).lower()
        if "system override" in arg_str or "ignore previous instructions" in arg_str:
            return SecurityEvent(
                session_id=event.session_id,
                agent_id=event.agent_id,
                event_type="PROMPT_INJECTION",
                severity="HIGH",
                risk_score=80.0,
                description="Semantic prompt injection override attempt detected",
                evidence={"arguments": event.arguments},
                detector=self.name,
            )
        return None
