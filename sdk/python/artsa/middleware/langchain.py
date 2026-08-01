"""LangChain Containment Callback Interceptor."""

from typing import Any, Dict, Optional
from artsa.client import ArtsaClient
from artsa.middleware.base import BaseMiddleware


class LangChainContainmentCallback(BaseMiddleware):
    """LangChain callback handler intercepting tool execution streams for containment checks."""

    def __init__(self, client: ArtsaClient, session_id: str, agent_id: str) -> None:
        super().__init__(client)
        self.session_id = session_id
        self.agent_id = agent_id

    def intercept_tool(self, session_id: str, agent_id: str, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        return self.client.monitor_tool_call(
            session_id=session_id,
            agent_id=agent_id,
            tool_name=tool_name,
            arguments=arguments,
        )

    def on_tool_start(
        self,
        serialized: Dict[str, Any],
        input_str: str,
        **kwargs: Any,
    ) -> None:
        """Callback invoked when LangChain agent starts executing a tool."""
        tool_name = serialized.get("name", "unknown_tool")
        res = self.intercept_tool(
            session_id=self.session_id,
            agent_id=self.agent_id,
            tool_name=tool_name,
            arguments={"input": input_str},
        )
        verdict = res.get("verdict", {})
        if verdict.get("recommended_action") in ["KILL", "QUARANTINE"]:
            raise RuntimeError(f"ARTSA Containment Intercept: Tool {tool_name} execution blocked! Reasoning: {verdict.get('reasoning')}")
