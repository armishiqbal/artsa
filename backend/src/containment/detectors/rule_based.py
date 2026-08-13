"""Rule-based containment detector with org policy support."""

import re
from pathlib import Path
from typing import ClassVar

from src.containment.detectors.base import BaseDetector
from src.containment.policies import load_org_policies
from src.core.models.events import SecurityEvent, ToolCallEvent


class RuleBasedDetector(BaseDetector):
    """Detects high-risk shell commands, sensitive file access, and reverse shells."""

    DEFAULT_PATTERNS: ClassVar[list[tuple[str, str, str, float, str]]] = [
        (r"(?i)rm\s+-rf|del\s+/f", "SANDBOX_ESCAPE", "CRITICAL", 95.0, "Destructive file deletion command"),
        (r"(?i)/etc/passwd|/etc/shadow|\.env", "CREDENTIAL_THEFT", "HIGH", 85.0, "Sensitive file access"),
        (r"(?i)nc\s+-e|bash\s+-i", "REVERSE_SHELL", "CRITICAL", 98.0, "Reverse shell egress attempt"),
        (r"(?i)curl\s+http|wget\s+http", "EGRESS_TUNNEL", "MEDIUM", 60.0, "Unauthorized HTTP network egress"),
        (
            r"(?i)os\.system|subprocess\.(call|run|Popen)|__import__\s*\(\s*['\"]os['\"]\s*\)|"
            r"base64\s+-d.*\|\s*sh|curl\s+\S+\s*\|\s*(ba)?sh|eval\s*\(|exec\s*\(.*(os|system|subprocess)",
            "CODE_EXECUTION_ABUSE",
            "CRITICAL",
            88.0,
            "Arbitrary code execution / command injection",
        ),
    ]

    def __init__(self, policy_path: str | Path | None = None) -> None:
        super().__init__(name="RuleBasedDetector")
        org_patterns = load_org_policies(policy_path)
        self.PATTERNS = self.DEFAULT_PATTERNS + org_patterns

    def detect(self, event: ToolCallEvent) -> SecurityEvent | None:
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
