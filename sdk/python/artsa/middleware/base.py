"""Base Agent Middleware Class."""

from abc import ABC, abstractmethod
from typing import Any, Dict
from artsa.client import ArtsaClient


class BaseMiddleware(ABC):
    """Abstract base class for framework-level agent tool call interceptors."""

    def __init__(self, client: ArtsaClient) -> None:
        self.client = client

    @abstractmethod
    def intercept_tool(self, session_id: str, agent_id: str, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Intercept tool call and send to ARTSA containment engine."""
        pass
