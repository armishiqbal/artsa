"""Python decorator — wrap any tool function with ARTSA containment."""

from __future__ import annotations

from functools import wraps
from typing import Any, Callable, Dict, Optional
from uuid import uuid4

from artsa.client import ArtsaClient


def guarded_tool(
    client: ArtsaClient,
    *,
    session_id: Optional[str] = None,
    agent_id: str = "python-agent",
    tool_name: Optional[str] = None,
    arg_mapper: Optional[Callable[..., Dict[str, Any]]] = None,
) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    """Decorator that evaluates each call against ARTSA before running the tool.

    Example::

        client = ArtsaClient(api_key="...")

        @guarded_tool(client, agent_id="support-bot")
        def read_file(path: str) -> str:
            return open(path).read()
    """

    def decorator(fn: Callable[..., Any]) -> Callable[..., Any]:
        name = tool_name or fn.__name__

        @wraps(fn)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            sid = session_id or str(uuid4())
            arguments = arg_mapper(*args, **kwargs) if arg_mapper else {**kwargs}
            if args and not arg_mapper:
                arguments = {"args": list(args), **kwargs}
            client.guard_tool_call(sid, agent_id, name, arguments)
            return fn(*args, **kwargs)

        return wrapper

    return decorator
