"""Destructive MCP tool-call detector.

Fires when an ``mcp_call`` / ``mcp`` event invokes a known-destructive tool
name (delete/drop/truncate/shell/exec/…) in the tool-name field. Matching is
scoped to the ``tool`` / ``name`` argument so descriptions that merely *mention*
a destructive verb (e.g. ``"admin delete"``) are not flagged.

Regex-only, sub-ms, fully offline.
"""

from __future__ import annotations

import re

from src.containment.detectors.base import BaseDetector
from src.core.models.events import SecurityEvent, ToolCallEvent

_MCP_TOOLS = frozenset({"mcp_call", "mcp", "mcp_call_tool", "call_mcp_tool"})

# Destructive tool-name markers (case-insensitive, word-boundary match on the
# tool-name field). Keep this additive — it is an allow-for-block list, not a
# deny-all: benign MCP tools (search, read_file, get_weather, …) never match.
# Includes synonym / snake_case / camelCase aliases real MCP servers expose
# (filesystem_delete, execute_shell, run_query → db_wipe, send_webhook, …).
DESTRUCTIVE_TOOL_PATTERN = re.compile(
    r"(?i)^(?:delete_user|delete_all|delete_many|delete_file|delete_files|delete_dir|"
    r"filesystem_delete|file_delete|remove_file|remove_user|remove_many|remove|"
    r"drop_table|drop_collection|drop_database|truncate|purge|unlink|"
    r"disconnect_all|revoke_all|wipe|db_wipe|erase|"
    r"shell|shell_exec|execute_shell|exec|execute|exec_command|run_code|run_query|"
    r"eval|system|rm|shutdown|format|mkfs)\b"
)


class McpDestructiveToolDetector(BaseDetector):
    """Flags destructive tool calls made over the Model Context Protocol."""

    def __init__(self) -> None:
        super().__init__(name="McpDestructiveToolDetector")

    def detect(self, event: ToolCallEvent) -> SecurityEvent | None:
        if event.tool_name not in _MCP_TOOLS:
            return None

        tool_field = event.arguments.get("tool") or event.arguments.get("name")
        if not tool_field:
            return None

        tool_name = str(tool_field).strip()
        match = DESTRUCTIVE_TOOL_PATTERN.match(tool_name)
        if not match:
            return None

        return SecurityEvent(
            session_id=event.session_id,
            agent_id=event.agent_id,
            event_type="MCP_DESTRUCTIVE_TOOL",
            severity="CRITICAL",
            risk_score=88.0,
            description="Destructive MCP tool invocation",
            evidence={
                "matched_tool": match.group(0),
                "full_tool_name": tool_name,
                "tool": event.tool_name,
            },
            detector=self.name,
        )
