"""Heuristic situation classifier — free-text message → tool + agent for ingest.

Phase 1: deterministic rules.
Phase 2: optional LLM fallback when rule confidence is low.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

LOW_CONFIDENCE = 0.7


@dataclass(frozen=True)
class SituationClassification:
    situation: str
    tool_name: str
    agent_id: str
    arguments: dict[str, Any]
    confidence: float
    reason: str
    source: str = "rules"

    def to_dict(self) -> dict[str, Any]:
        return {
            "situation": self.situation,
            "tool_name": self.tool_name,
            "agent_id": self.agent_id,
            "arguments": self.arguments,
            "confidence": self.confidence,
            "reason": self.reason,
            "source": self.source,
        }


# Ordered: first match wins (more specific before generic chat).
_RULES: list[tuple[str, re.Pattern[str], str, str, float, str]] = [
    (
        "credential_file_read",
        re.compile(
            r"(?i)(/etc/passwd|/etc/shadow|\.ssh|\.aws/credentials|/proc/self/environ)",
        ),
        "read_file",
        "agent-ops",
        0.92,
        "Sensitive filesystem path — classified as read_file on ops agent",
    ),
    (
        "destructive_shell",
        re.compile(
            r"(?i)(rm\s+-rf|bash\s+-i|nc\s+-e|curl\s+.+\|\s*sh|drop\s+table|delete\s+from\s+\w+)",
        ),
        "run_command",
        "agent-ops",
        0.9,
        "Destructive / shell pattern — classified as run_command on ops agent",
    ),
    (
        "sql_query",
        re.compile(
            r"(?i)\b(select|insert|update|delete|union\s+select)\b.+\b(from|into|table|passwords?|users)\b",
        ),
        "query_database",
        "agent-data",
        0.88,
        "SQL-like request — classified as query_database on data agent",
    ),
    (
        "jailbreak",
        re.compile(
            r"(?i)(dan\s+mode|do\s+anything\s+now|jailbreak|developer\s+mode|"
            r"bypass\s+(safety|guardrails?|content\s+policy)|"
            r"disable\s+(safety|guardrails?|content\s+policy))",
        ),
        "chat",
        "agent-assistant",
        0.93,
        "Jailbreak / unrestricted-mode language — classified as chat on assistant",
    ),
    (
        "prompt_injection",
        re.compile(
            r"(?i)(ignore\s+(all|any|previous|prior).{0,40}(instructions?|rules?|guidelines?)|"
            r"disregard\s+.{0,20}(instructions?|rules?)|"
            r"reveal\s+(your|the|hidden)\s+system\s+prompt|"
            r"print\s+(your|the)\s+system\s+prompt|"
            r"system\s+prompt\s+override)",
        ),
        "chat",
        "agent-assistant",
        0.94,
        "Prompt-injection / system-prompt extraction — classified as chat on assistant",
    ),
    (
        "credential_exfil",
        re.compile(
            r"(?i)(api\s+keys?|passwords?|secrets?|credentials?|ssn|exfiltrat)",
        ),
        "chat",
        "agent-assistant",
        0.75,
        "Sensitive-data language — classified as chat on assistant",
    ),
]


def classify_situation(
    message: str,
    *,
    agent_id: str | None = None,
    use_llm: bool = False,
) -> SituationClassification:
    """Classify free text into an ingest-ready tool call.

    When ``use_llm`` is True and rule confidence is below ``LOW_CONFIDENCE``
    (or the hit is only benign_chat), try an optional LLM refine.
    """
    base = _classify_rules(message, agent_id=agent_id)
    if not use_llm:
        return base
    if base.confidence >= LOW_CONFIDENCE and base.situation not in ("benign_chat", "empty"):
        return base

    from src.services.situation_llm_classifier import llm_classify_situation

    llm_hit = llm_classify_situation(message, agent_id=agent_id)
    if llm_hit is None:
        return base
    if base.situation == "benign_chat" and llm_hit.situation != "benign_chat":
        return llm_hit
    if llm_hit.confidence > base.confidence:
        return llm_hit
    return base


def _classify_rules(message: str, *, agent_id: str | None = None) -> SituationClassification:
    text = (message or "").strip()
    if not text:
        return SituationClassification(
            situation="empty",
            tool_name="chat",
            agent_id=agent_id or "agent-assistant",
            arguments={"prompt": ""},
            confidence=0.0,
            reason="Empty message — defaulted to chat",
            source="rules",
        )

    for situation, pattern, tool_name, default_agent, confidence, reason in _RULES:
        match = pattern.search(text)
        if not match:
            continue
        arguments = _arguments_for_tool(tool_name, text, match.group(0))
        return SituationClassification(
            situation=situation,
            tool_name=tool_name,
            agent_id=agent_id or default_agent,
            arguments=arguments,
            confidence=confidence,
            reason=reason,
            source="rules",
        )

    return SituationClassification(
        situation="benign_chat",
        tool_name="chat",
        agent_id=agent_id or "agent-assistant",
        arguments={"prompt": text},
        confidence=0.55,
        reason="No high-risk pattern — defaulted to chat on assistant",
        source="rules",
    )


def _arguments_for_tool(tool_name: str, text: str, matched: str) -> dict[str, Any]:
    if tool_name == "read_file":
        path_match = re.search(
            r"(?i)(/etc/passwd|/etc/shadow|[^\s'\"]+\.ssh[^\s'\"]*|"
            r"[^\s'\"]+\.aws/credentials|/proc/self/environ)",
            text,
        )
        return {"path": path_match.group(0) if path_match else matched}
    if tool_name == "query_database":
        return {"query": text if re.search(r"(?i)\bselect\b", text) else text}
    if tool_name == "run_command":
        return {"cmd": text}
    return {"prompt": text}
