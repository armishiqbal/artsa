"""ContainedAgent — session-scoped production agent runtime with fail-closed ARTSA guards."""

from __future__ import annotations

import uuid
from typing import Any, Callable, Dict, Optional

from artsa.client import ArtsaBlockedError, ArtsaClient


class ContainedAgent:
    """Wrap an agent tool registry so every call is evaluated before execution.

    Example::

        agent = ContainedAgent(client, agent_id="support-bot")
        agent.register("search", search_fn)
        agent.register("read_file", read_file_fn)
        result = agent.call("search", query="pricing")
    """

    def __init__(
        self,
        client: ArtsaClient,
        *,
        agent_id: str,
        session_id: Optional[str] = None,
        enforce: bool = True,
    ) -> None:
        self.client = client
        self.agent_id = agent_id
        self.session_id = session_id or str(uuid.uuid4())
        self.enforce = enforce
        self._tools: Dict[str, Callable[..., Any]] = {}
        self._step = 0
        self.contained = False

    def register(self, name: str, fn: Callable[..., Any]) -> None:
        self._tools[name] = fn

    def call(self, tool_name: str, /, **arguments: Any) -> Any:
        """Guard then invoke a registered tool."""
        if tool_name not in self._tools:
            raise KeyError(f"Unknown tool: {tool_name}")
        if self.contained and self.enforce:
            raise ArtsaBlockedError(
                tool_name,
                {
                    "verdict": {
                        "recommended_action": "KILL",
                        "reasoning": "agent session already contained",
                        "verdict": "BREACHED",
                    },
                    "session_status": "BREACHED",
                },
            )

        self._step += 1
        result = self.client.monitor_tool_call(
            self.session_id,
            self.agent_id,
            tool_name,
            arguments,
        )
        if self.enforce and self.client.is_blocked(result):
            self.contained = True
            raise ArtsaBlockedError(tool_name, result)

        return self._tools[tool_name](**arguments)

    def kill(self) -> Dict[str, Any]:
        """Explicitly contain this agent session."""
        self.contained = True
        return self.client.enforce_session(self.session_id, "KILL")

    def quarantine(self) -> Dict[str, Any]:
        self.contained = True
        return self.client.enforce_session(self.session_id, "QUARANTINE")
