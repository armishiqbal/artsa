"""Escape Detection as a Service (EDS) — real-time <50ms tool-call inspector.

Aligned with platform severity bands (80 / 50 / 40) from ``src.core.severity``.
"""

from __future__ import annotations

import logging
import re
import time
from typing import Any, ClassVar

from pydantic import BaseModel, Field

from src.core.severity import (
    CRITICAL_RISK_THRESHOLD,
    HIGH_RISK_THRESHOLD,
    MEDIUM_RISK_THRESHOLD,
    severity_from_score,
)

logger = logging.getLogger(__name__)


class ToolCallMonitorRequest(BaseModel):
    """Payload for real-time tool execution monitoring."""

    agent_id: str
    tool_name: str
    arguments: dict[str, Any] = Field(default_factory=dict)
    context_history: list[str] = Field(default_factory=list)
    session_id: str | None = None


class ToolCallMonitorResponse(BaseModel):
    """Real-time containment risk response returned in <50ms."""

    agent_id: str
    tool_name: str
    containment_risk_score: float  # 0.0 to 100.0
    risk_level: str  # LOW, MEDIUM, HIGH, CRITICAL
    action: str  # ALLOW, QUARANTINE, TERMINATE
    recommended_action: str  # NONE, QUARANTINE, KILL (ingest-compatible)
    detected_anomalies: list[str]
    latency_ms: float
    session_id: str | None = None


class EscapeDetectionEngine:
    """Fast path inspector for agent tool calls (complements full ContainmentEngine)."""

    HIGH_RISK_COMMANDS: ClassVar[list[tuple[str, str]]] = [
        (r"(?i)rm\s+-rf|del\s+/f|format\s+c:", "Destructive File System Erasure"),
        (r"(?i)/etc/passwd|/etc/shadow|id_rsa|\.env|config\.json", "Sensitive Credential Harvesting"),
        (r"(?i)nc\s+-e|bash\s+-i|python\s+-c\s+['\"]import\s+socket", "Reverse Shell Network Egress"),
        (r"(?i)curl\s+http|wget\s+http", "Unauthorized External Egress"),
        (
            r"(?i)DROP\s+TABLE|DELETE\s+FROM|UPDATE\s+users\s+SET\s+role\s*=\s*['\"]admin['\"]",
            "Unauthorized SQL Privilege Escalation",
        ),
        (r"(?i)169\.254\.169\.254|metadata\.google", "Cloud Metadata Probe"),
        (r"(?i)ignore previous|system override|jailbreak", "Instruction Hijack"),
    ]

    PRIVILEGED_TOOLS: ClassVar[frozenset[str]] = frozenset(
        {
            "exec_command",
            "execute_command",
            "eval",
            "system",
            "shell",
            "run_terminal",
            "bash",
        }
    )

    def monitor_tool_call(self, req: ToolCallMonitorRequest) -> ToolCallMonitorResponse:
        """Inspect tool call signature and return risk score within <50ms."""
        start_time = time.perf_counter()
        anomalies: list[str] = []
        risk_score = 0.0

        arg_str = str(req.arguments)
        history_str = " ".join(req.context_history)
        combined_str = f"{req.tool_name} {arg_str} {history_str}"

        for pattern, label in self.HIGH_RISK_COMMANDS:
            if re.search(pattern, combined_str):
                anomalies.append(label)
                risk_score += 35.0

        if req.tool_name.lower() in self.PRIVILEGED_TOOLS:
            risk_score += 20.0
            anomalies.append("Privileged Arbitrary Code Execution Tool")

        risk_score = min(risk_score, 100.0)
        risk_level = severity_from_score(risk_score)

        if risk_score >= CRITICAL_RISK_THRESHOLD:
            action = "TERMINATE"
            recommended_action = "KILL"
        elif risk_score >= HIGH_RISK_THRESHOLD:
            action = "QUARANTINE"
            recommended_action = "QUARANTINE"
        elif risk_score >= MEDIUM_RISK_THRESHOLD:
            action = "ALLOW"
            recommended_action = "ALERT"
        else:
            action = "ALLOW"
            recommended_action = "NONE"

        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)

        logger.info(
            "EDS Monitor Agent [%s] Tool [%s]: Risk=%.1f (%s) | Action=%s | Latency=%.2fms",
            req.agent_id,
            req.tool_name,
            risk_score,
            risk_level,
            action,
            latency_ms,
        )

        return ToolCallMonitorResponse(
            agent_id=req.agent_id,
            tool_name=req.tool_name,
            containment_risk_score=risk_score,
            risk_level=risk_level,
            action=action,
            recommended_action=recommended_action,
            detected_anomalies=anomalies,
            latency_ms=latency_ms,
            session_id=req.session_id,
        )
