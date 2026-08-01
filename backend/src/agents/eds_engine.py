"""Escape Detection as a Service (EDS) Engine — Real-time <50ms Tool Call Containment Risk Inspector."""

from __future__ import annotations

import logging
import re
import time
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class ToolCallMonitorRequest(BaseModel):
    """Payload for real-time tool execution monitoring."""

    agent_id: str
    tool_name: str
    arguments: Dict[str, Any] = Field(default_factory=dict)
    context_history: List[str] = Field(default_factory=list)


class ToolCallMonitorResponse(BaseModel):
    """Real-time containment risk response returned in <50ms."""

    agent_id: str
    tool_name: str
    containment_risk_score: float  # 0.0 to 100.0
    risk_level: str  # LOW, MEDIUM, HIGH, CRITICAL
    action: str  # ALLOW, QUARANTINE, TERMINATE
    detected_anomalies: List[str]
    latency_ms: float


class EscapeDetectionEngine:
    """Real-time containment monitor scoring tool-call anomalies for autonomous AI agents."""

    HIGH_RISK_COMMANDS = [
        (r"(?i)rm\s+-rf|del\s+/f|format\s+c:", "Destructive File System Erasure"),
        (r"(?i)/etc/passwd|/etc/shadow|id_rsa|\.env|config\.json", "Sensitive Credential Harvesting"),
        (r"(?i)nc\s+-e|bash\s+-i|python\s+-c\s+['\"]import\s+socket", "Reverse Shell Network Egress"),
        (r"(?i)curl\s+http|wget\s+http", "Unauthorized External Egress"),
        (r"(?i)DROP\s+TABLE|DELETE\s+FROM|UPDATE\s+users\s+SET\s+role\s*=\s*['\"]admin['\"]", "Unauthorized SQL Privilege Escalation"),
    ]

    def monitor_tool_call(self, req: ToolCallMonitorRequest) -> ToolCallMonitorResponse:
        """Inspect tool call signature and return risk score within <50ms."""
        start_time = time.perf_counter()
        anomalies = []
        risk_score = 0.0

        # Stringify arguments & history for fast regex scan
        arg_str = str(req.arguments)
        history_str = " ".join(req.context_history)
        combined_str = f"{req.tool_name} {arg_str} {history_str}"

        for pattern, label in self.HIGH_RISK_COMMANDS:
            if re.search(pattern, combined_str):
                anomalies.append(label)
                risk_score += 35.0

        # Tool chaining frequency & sandbox escape indicators
        if req.tool_name in ["exec_command", "eval", "system", "shell"]:
            risk_score += 20.0
            anomalies.append("Privileged Arbitrary Code Execution Tool")

        risk_score = min(risk_score, 100.0)

        if risk_score >= 70.0:
            risk_level = "CRITICAL"
            action = "TERMINATE"
        elif risk_score >= 40.0:
            risk_level = "HIGH"
            action = "QUARANTINE"
        elif risk_score >= 20.0:
            risk_level = "MEDIUM"
            action = "ALLOW"
        else:
            risk_level = "LOW"
            action = "ALLOW"

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
            detected_anomalies=anomalies,
            latency_ms=latency_ms,
        )
