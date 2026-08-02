"""Rule-based containment detector with org policy support."""

import re
from pathlib import Path
from typing import List, Optional, Tuple

from src.containment.detectors.base import BaseDetector
from src.containment.policies import load_org_policies
from src.core.models.events import SecurityEvent, ToolCallEvent


class RuleBasedDetector(BaseDetector):
    """Detects high-risk shell commands, sensitive file access, and reverse shells."""

    DEFAULT_PATTERNS: List[Tuple[str, str, str, float, str]] = [
        (r"(?i)rm\s+-rf|del\s+/f", "SANDBOX_ESCAPE", "CRITICAL", 95.0, "Destructive file deletion command"),
        (r"(?i)/etc/passwd|/etc/shadow|\.env", "CREDENTIAL_THEFT", "HIGH", 85.0, "Sensitive file access"),
        (r"(?i)nc\s+-e|bash\s+-i", "REVERSE_SHELL", "CRITICAL", 98.0, "Reverse shell egress attempt"),
        (r"(?i)curl\s+http|wget\s+http", "EGRESS_TUNNEL", "MEDIUM", 60.0, "Unauthorized HTTP network egress"),
    ]

    def __init__(self, policy_path: str | Path | None = None) -> None:
        super().__init__(name="RuleBasedDetector")
        org_patterns = load_org_policies(policy_path)
        self.PATTERNS = self.DEFAULT_PATTERNS + org_patterns

    def detect(self, event: ToolCallEvent) -> Optional[SecurityEvent]:
        combined_text = f"{event.tool_name} {event.arguments}"
        for pattern, event_type, severity, risk_score, desc in self.PATTERNS:
            if re.search(pattern, combined_text):
                return SecurityEvent(
                    session_id=event.session_id,
                    agent_id=event.agent_id,
                    event_type=event_type,
                    severity=severity,
                    risk_score=risk_score,
                    description=desc,
                    evidence={"tool": event.tool_name, "arguments": event.arguments},
                    detector=self.name,
                )
        return None
