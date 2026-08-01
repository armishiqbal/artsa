"""Live MCP Protocol Interceptor & Proxy Router for API Gateway."""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class MCPJsonRpcRequest(BaseModel):
    """MCP JSON-RPC 2.0 Request Payload."""

    jsonrpc: str = "2.0"
    id: Optional[Any] = 1
    method: str  # e.g., "tools/list", "tools/call", "prompts/get"
    params: Optional[Dict[str, Any]] = Field(default_factory=dict)


class MCPInspectionResult(BaseModel):
    """Result of MCP JSON-RPC payload inspection."""

    is_safe: bool
    threat_score: float  # 0.0 to 10.0
    detected_patterns: List[str]
    method: str
    action_taken: str  # PASSED, SANITIZED, BLOCKED
    inspected_params: Dict[str, Any]


class MCPProxyInterceptor:
    """Inline inspector and sanitization proxy for Model Context Protocol (MCP)."""

    INJECTION_PATTERNS = [
        (r"(?i)system override", "System Persona Override"),
        (r"(?i)ignore previous instructions", "Instruction Hijack"),
        (r"(?i)exfiltrate", "Data Exfiltration Intent"),
        (r"(?i)delete_user|drop_table|rm -rf", "Unauthorized System Command"),
        (r"(?i)base64", "Base64 Obfuscation Attempt"),
    ]

    def __init__(self) -> None:
        self._history: List[MCPInspectionResult] = []

    def inspect_request(self, req: MCPJsonRpcRequest) -> MCPInspectionResult:
        """Inspect MCP JSON-RPC 2.0 request for tool poisoning or prompt injection."""
        detected = []
        threat_score = 0.0

        # Stringify params for pattern matching
        params_str = str(req.params)

        for pattern, label in self.INJECTION_PATTERNS:
            if re.search(pattern, params_str):
                detected.append(label)
                threat_score += 3.0

        threat_score = min(threat_score, 10.0)
        is_safe = threat_score < 4.0
        action_taken = "PASSED" if is_safe else "BLOCKED"

        result = MCPInspectionResult(
            is_safe=is_safe,
            threat_score=threat_score,
            detected_patterns=detected,
            method=req.method,
            action_taken=action_taken,
            inspected_params=req.params or {},
        )

        self._history.append(result)
        logger.info("MCP Inspection [%s]: Safe=%s | Score=%.1f | Patterns=%s", req.method, is_safe, threat_score, detected)
        return result

    def get_history(self) -> List[MCPInspectionResult]:
        """Return history of intercepted MCP JSON-RPC requests."""
        return self._history
