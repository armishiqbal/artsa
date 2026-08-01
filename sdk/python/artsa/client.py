"""ARTSA Python SDK — Agent Instrumentation Client."""

from __future__ import annotations

import logging
import requests
from typing import Any, Dict, List, Optional

logger = logging.getLogger("artsa.sdk")


class ArtsaClient:
    """ARTSA Python Client for real-time tool call containment monitoring and wargame execution."""

    def __init__(self, api_url: str = "http://localhost:8000", api_key: Optional[str] = None) -> None:
        self.api_url = api_url.rstrip("/")
        self.api_key = api_key

    def monitor_tool_call(self, agent_id: str, tool_name: str, arguments: Dict[str, Any], context_history: Optional[List[str]] = None) -> Dict[str, Any]:
        """Send tool call execution event to ARTSA EDS engine for real-time <50ms inspection."""
        payload = {
            "agent_id": agent_id,
            "tool_name": tool_name,
            "arguments": arguments,
            "context_history": context_history or [],
        }
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        try:
            res = requests.post(f"{self.api_url}/api/v1/eds/monitor-tool-call", json=payload, headers=headers, timeout=1.0)
            res.raise_for_status()
            return res.json()
        except Exception as e:
            logger.warning("ARTSA SDK fallback ALLOW for tool %s: %s", tool_name, e)
            return {"action": "ALLOW", "containment_risk_score": 0.0, "error": str(e)}


def test(agent_id: str, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
    """Helper method for quick Shift-Left agent testing."""
    client = ArtsaClient()
    return client.monitor_tool_call(agent_id=agent_id, tool_name=tool_name, arguments=arguments)
