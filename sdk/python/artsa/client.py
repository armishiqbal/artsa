"""ARTSA Client Implementation."""

import uuid
import logging
import requests
from typing import Any, Dict, Optional

logger = logging.getLogger("artsa.sdk")


class ArtsaClient:
    """Client for instrumenting AI agents with real-time escape containment monitoring."""

    def __init__(self, api_url: str = "http://localhost:8000", api_key: Optional[str] = None) -> None:
        self.api_url = api_url.rstrip("/")
        self.api_key = api_key

    def monitor_tool_call(
        self,
        session_id: str,
        agent_id: str,
        tool_name: str,
        arguments: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Send live tool call execution to ARTSA containment engine."""
        payload = {
            "id": str(uuid.uuid4()),
            "session_id": session_id,
            "agent_id": agent_id,
            "tool_name": tool_name,
            "arguments": arguments,
            "trace_id": str(uuid.uuid4()),
        }
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        try:
            res = requests.post(
                f"{self.api_url}/api/v1/ingest",
                json=payload,
                headers=headers,
                timeout=0.5,  # Sub-50ms target timeout
            )
            res.raise_for_status()
            return res.json()
        except Exception as e:
            logger.warning("ARTSA containment check fallback ALLOW: %s", e)
            return {
                "verdict": {"verdict": "SAFE", "recommended_action": "NONE"},
                "risk_score": {"overall_score": 0.0},
            }
