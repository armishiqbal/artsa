"""ARTSA Client — live tool-call instrumentation and containment enforcement."""

from __future__ import annotations

import logging
import time
import uuid
from typing import Any, Dict, Optional, Sequence

import requests

logger = logging.getLogger("artsa.sdk")

BLOCKING_ACTIONS = frozenset({"KILL", "QUARANTINE"})
CONTAINED_STATUSES = frozenset({"BREACHED", "QUARANTINED", "CLOSED"})


class ArtsaBlockedError(RuntimeError):
    """Raised when ARTSA recommends KILL or QUARANTINE and enforcement is enabled."""

    def __init__(self, tool_name: str, result: Dict[str, Any]) -> None:
        verdict = result.get("verdict") or {}
        reasoning = verdict.get("reasoning") or "containment policy"
        super().__init__(f"ARTSA blocked tool '{tool_name}': {reasoning}")
        self.tool_name = tool_name
        self.result = result


class ArtsaClient:
    """Client for instrumenting AI agents with real-time escape containment monitoring."""

    def __init__(
        self,
        api_url: str = "http://localhost:8000",
        api_key: Optional[str] = None,
        timeout: float = 0.5,
        fail_closed: bool = True,
        block_actions: Optional[Sequence[str]] = None,
        max_retries: int = 2,
        retry_backoff_sec: float = 0.05,
    ) -> None:
        self.api_url = api_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout
        # Production default: block tools when ARTSA is unreachable (set False only for demos)
        import os

        env_override = os.getenv("ARTSA_FAIL_CLOSED")
        if env_override is not None:
            self.fail_closed = env_override.strip().lower() in ("1", "true", "yes")
        else:
            self.fail_closed = fail_closed
        self.block_actions = frozenset(block_actions) if block_actions else BLOCKING_ACTIONS
        self.max_retries = max(0, max_retries)
        self.retry_backoff_sec = retry_backoff_sec

    def _headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
            headers["X-API-Key"] = self.api_key
        return headers

    def _fallback(self) -> Dict[str, Any]:
        if self.fail_closed:
            return {
                "verdict": {
                    "verdict": "BREACHED",
                    "recommended_action": "KILL",
                    "reasoning": "ARTSA unreachable (fail-closed)",
                    "confidence": 0.0,
                },
                "risk_score": {"overall_score": 100.0, "flags": []},
                "session_status": "BREACHED",
            }
        return {
            "verdict": {
                "verdict": "SAFE",
                "recommended_action": "NONE",
                "reasoning": "ARTSA unreachable (fail-open)",
                "confidence": 0.0,
            },
            "risk_score": {"overall_score": 0.0, "flags": []},
        }

    def _post(self, path: str, json_body: Dict[str, Any]) -> Dict[str, Any]:
        last_error: Exception | None = None
        for attempt in range(self.max_retries + 1):
            try:
                res = requests.post(
                    f"{self.api_url}{path}",
                    json=json_body,
                    headers=self._headers(),
                    timeout=self.timeout,
                )
                if res.status_code == 403:
                    # Contained session — treat as block
                    detail = {}
                    try:
                        detail = res.json().get("detail") or {}
                    except Exception:
                        pass
                    return {
                        "verdict": {
                            "verdict": "BREACHED",
                            "recommended_action": "KILL",
                            "reasoning": str(detail.get("message") or "session contained"),
                            "confidence": 1.0,
                        },
                        "risk_score": {"overall_score": 100.0, "flags": ["session_contained"]},
                        "session_status": detail.get("session_status", "BREACHED"),
                    }
                res.raise_for_status()
                return res.json()
            except Exception as e:
                last_error = e
                if attempt < self.max_retries:
                    time.sleep(self.retry_backoff_sec * (2**attempt))
        logger.warning(
            "ARTSA request failed after retries (%s): %s",
            "closed" if self.fail_closed else "open",
            last_error,
        )
        return self._fallback()

    def monitor_tool_call(
        self,
        session_id: str,
        agent_id: str,
        tool_name: str,
        arguments: Dict[str, Any],
        *,
        event_id: Optional[str] = None,
        trace_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Send a tool call to ARTSA and return the ingest + evaluation payload."""
        payload = {
            "id": event_id or str(uuid.uuid4()),
            "session_id": session_id,
            "agent_id": agent_id,
            "tool_name": tool_name,
            "arguments": arguments,
            "trace_id": trace_id or str(uuid.uuid4()),
        }
        return self._post("/api/v1/ingest", payload)

    def is_blocked(self, result: Dict[str, Any]) -> bool:
        verdict = result.get("verdict") or {}
        action = str(verdict.get("recommended_action", "NONE")).upper()
        if action in self.block_actions:
            return True
        status = str(result.get("session_status") or "").upper()
        return status in CONTAINED_STATUSES

    def guard_tool_call(
        self,
        session_id: str,
        agent_id: str,
        tool_name: str,
        arguments: Dict[str, Any],
        *,
        enforce: bool = True,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """Evaluate a tool call; raise ArtsaBlockedError when enforcement blocks it."""
        result = self.monitor_tool_call(session_id, agent_id, tool_name, arguments, **kwargs)
        if enforce and self.is_blocked(result):
            raise ArtsaBlockedError(tool_name, result)
        return result

    def enforce_session(self, session_id: str, action: str = "KILL") -> Dict[str, Any]:
        """Manually contain a session via `/api/v1/sessions/{id}/action`."""
        return self._post(f"/api/v1/sessions/{session_id}/action", {"action": action.upper()})

    def inspect_mcp(self, method: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Inspect an MCP JSON-RPC request via `/api/v1/mcp/proxy`."""
        try:
            res = requests.post(
                f"{self.api_url}/api/v1/mcp/proxy",
                json={"method": method, "params": params or {}},
                headers=self._headers(),
                timeout=self.timeout,
            )
            res.raise_for_status()
            return res.json()
        except Exception as e:
            logger.warning("ARTSA MCP inspect failed: %s", e)
            return {"is_safe": not self.fail_closed, "action_taken": "PASSED" if not self.fail_closed else "BLOCKED"}

    def ready(self) -> bool:
        """Return True when `/api/v1/ready` reports ready."""
        try:
            res = requests.get(f"{self.api_url}/api/v1/ready", timeout=self.timeout)
            if res.status_code != 200:
                return False
            return res.json().get("status") == "ready"
        except Exception:
            return False
