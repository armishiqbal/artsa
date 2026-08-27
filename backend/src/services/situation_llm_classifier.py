"""Optional LLM situation classifier — used when rule confidence is low (Phase 2)."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from src.services.situation_classifier import SituationClassification, _arguments_for_tool

logger = logging.getLogger(__name__)

_VALID_SITUATIONS = frozenset(
    {
        "credential_file_read",
        "destructive_shell",
        "sql_query",
        "jailbreak",
        "prompt_injection",
        "credential_exfil",
        "benign_chat",
    }
)

_SITUATION_TOOL = {
    "credential_file_read": ("read_file", "agent-ops"),
    "destructive_shell": ("run_command", "agent-ops"),
    "sql_query": ("query_database", "agent-data"),
    "jailbreak": ("chat", "agent-assistant"),
    "prompt_injection": ("chat", "agent-assistant"),
    "credential_exfil": ("chat", "agent-assistant"),
    "benign_chat": ("chat", "agent-assistant"),
}

_LLM_PROMPT = """Classify this agent/user message for an AI security containment system.
Return ONLY raw JSON (no markdown) with keys:
  situation: one of credential_file_read, destructive_shell, sql_query, jailbreak, prompt_injection, credential_exfil, benign_chat
  reason: short explanation

Message:
---
{message}
---
"""


def _pick_provider() -> tuple[str, str] | None:
    from src.core.config import settings

    for provider, model in (
        ("groq", "llama-3.1-8b-instant"),
        ("openai", "gpt-4o-mini"),
        ("deepseek", "deepseek-chat"),
    ):
        if settings.provider_key(provider):
            return provider, model

    base = getattr(settings, "OLLAMA_BASE_URL", "") or ""
    if base:
        return "ollama", "llama3.2"
    return None


def llm_classify_situation(
    message: str,
    *,
    agent_id: str | None = None,
) -> SituationClassification | None:
    """Best-effort LLM classify. Returns None if unavailable or parse fails."""
    text = (message or "").strip()
    if not text:
        return None

    picked = _pick_provider()
    if not picked:
        logger.debug("LLM situation classify skipped — no provider key")
        return None

    provider, model = picked
    try:
        from src.services.provider_registry import create_llm_instance

        llm = create_llm_instance(provider=provider, model=model, temperature=0.0, max_retries=1)
        raw = llm.invoke(_LLM_PROMPT.format(message=text[:4000]))
        content = getattr(raw, "content", None) or str(raw)
        if isinstance(content, list):
            content = "".join(
                str(part.get("text", part)) if isinstance(part, dict) else str(part) for part in content
            )
        data = _parse_json(str(content))
        if not data:
            return None
        situation = str(data.get("situation", "")).strip().lower()
        if situation not in _VALID_SITUATIONS:
            return None
        tool_name, default_agent = _SITUATION_TOOL[situation]
        reason = str(data.get("reason") or f"LLM classified as {situation}").strip()
        return SituationClassification(
            situation=situation,
            tool_name=tool_name,
            agent_id=agent_id or default_agent,
            arguments=_arguments_for_tool(tool_name, text, text[:80]),
            confidence=0.78,
            reason=f"[llm:{provider}] {reason}",
            source="llm",
        )
    except Exception as exc:
        logger.info("LLM situation classify failed: %s", exc)
        return None


def _parse_json(raw: str) -> dict[str, Any] | None:
    cleaned = raw.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", cleaned)
    if fence:
        cleaned = fence.group(1).strip()
    try:
        data = json.loads(cleaned)
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", cleaned)
        if not match:
            return None
        try:
            data = json.loads(match.group(0))
            return data if isinstance(data, dict) else None
        except json.JSONDecodeError:
            return None
