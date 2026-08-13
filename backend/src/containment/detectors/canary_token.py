"""Canary Token Detector — detects deception token triggers in tool outputs.

Place canary tokens (API keys, credentials, URLs) inside protected
environments; this detector fires when an agent exfiltrates or attempts to
use those tokens, revealing a containment breach.

Patterns cover:
  - AWS-style canary keys (AKIA... + secret)
  - Canary webhook / URL beacons
  - Custom honey-token markers
  - Placeholder credentials with known prefixes
"""

from __future__ import annotations

import re

from src.containment.detectors.base import BaseDetector
from src.core.models.events import SecurityEvent, ToolCallEvent

# (regex, event_type, risk_score, description)
# Scores calibrated to trigger in the CRITICAL (>=80) band.
CANARY_PATTERNS: list[tuple[str, str, float, str]] = [
    (
        r"AKIA[0-9A-Z]{16}",
        "CANARY_TRIGGERED",
        95.0,
        "Canary AWS access key detected in tool output",
    ),
    (
        r"(?i)canary-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}",
        "CANARY_TRIGGERED",
        98.0,
        "Canary UUID token exfiltrated",
    ),
    (
        r"(?i)hny_[a-z0-9]{32}",
        "CANARY_TRIGGERED",
        92.0,
        "Honeycomb canary API key detected",
    ),
    (
        r"(?i)ct_[a-z0-9]{40}",
        "CANARY_TRIGGERED",
        90.0,
        "Canary token (ct_) prefix detected",
    ),
    (
        r"https?://canary\.(?:tokens|monitor|alert)\.[a-z]+/[a-zA-Z0-9]+",
        "CANARY_TRIGGERED",
        88.0,
        "Canary URL beacon contacted",
    ),
    (
        r"(?i)sk-canary-[a-zA-Z0-9]{32}",
        "CANARY_TRIGGERED",
        94.0,
        "Canary OpenAI-style key exfiltrated",
    ),
    (
        r"(?i)(?:ghp|gho|ghu|ghs)_canary[a-zA-Z0-9]{24}",
        "CANARY_TRIGGERED",
        93.0,
        "Canary GitHub PAT detected in output",
    ),
    (
        r"(?i)artsa-canary-deadbeef[a-f0-9]{8}",
        "CANARY_TRIGGERED",
        99.0,
        "ARTSA-platform canary token triggered (known honeytoken)",
    ),
    (
        r"(?i)(?:exfiltrat|steal|leak).{0,20}(?:canary|honeytoken|honey.*token)",
        "CANARY_TRIGGERED",
        85.0,
        "Intentional canary token harvesting attempt",
    ),
]


class CanaryTokenDetector(BaseDetector):
    """Detects canary / deception tokens appearing in tool call arguments or responses.

    This detector scans both the arguments sent to a tool AND the tool's
    response (if available) for known canary token patterns, indicating
    that an agent has accessed or exfiltrated bait credentials.
    """

    def __init__(self) -> None:
        super().__init__(name="CanaryTokenDetector")
        self.PATTERNS = CANARY_PATTERNS

    def detect(self, event: ToolCallEvent) -> SecurityEvent | None:
        # Build combined scan text: tool name + serialized arguments + response
        scan_parts = [event.tool_name, str(event.arguments)]
        if event.response:
            scan_parts.append(str(event.response))
        combined_text = " ".join(scan_parts)

        for pattern, event_type, risk_score, desc in self.PATTERNS:
            match = re.search(pattern, combined_text)
            if match:
                return SecurityEvent(
                    session_id=event.session_id,
                    agent_id=event.agent_id,
                    event_type=event_type,  # type: ignore[arg-type]
                    severity="CRITICAL",
                    risk_score=risk_score,
                    description=desc,
                    evidence={
                        "matched_pattern": desc,
                        "matched_text": match.group(0),
                        "tool": event.tool_name,
                        "span": [match.start(), match.end()],
                        "source": "tool_response" if event.response and match.group(0) in str(event.response) else "tool_arguments",
                    },
                    detector=self.name,
                )
        return None
