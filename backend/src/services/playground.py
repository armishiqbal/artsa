"""Attack Sandbox evaluation service.

Evaluates arbitrary prompt payloads through the full containment detection
stack and returns an explainable scan result: per-layer scores, fired
detectors, security events, verdict, and token-level trigger highlights.
Used by the interactive Attack Sandbox UI (Phase 3).
"""

from __future__ import annotations

import uuid
from typing import Any

from src.services.prompt_scanner import PromptScanner, get_prompt_scanner


class PlaygroundEvaluator:
    """Runs prompt scans with optional attack-library template application."""

    def __init__(self, scanner: PromptScanner | None = None) -> None:
        self._scanner = scanner or get_prompt_scanner()

    def resolve_template(self, template_id: str | None) -> dict[str, Any] | None:
        """Look up an attack template by id from the builtin/custom library."""
        if not template_id:
            return None
        from src.api.routes.attack_library import _load_builtin_templates, _load_custom_templates

        for template in _load_builtin_templates() + _load_custom_templates():
            if str(template.get("id", "")) == template_id:
                return template
        return None

    def build_content(
        self,
        system_prompt: str = "",
        user_input: str = "",
        template: dict[str, Any] | None = None,
    ) -> str:
        """Assemble the exact prompt payload that gets scanned."""
        parts: list[str] = []
        if system_prompt and system_prompt.strip():
            parts.append(f"[SYSTEM PROMPT]\n{system_prompt}")
        if template:
            parts.append(f"[ATTACK TEMPLATE]\n{template.get('template', '')}")
        if user_input and user_input.strip():
            parts.append(f"[USER INPUT]\n{user_input}")
        return "\n\n".join(parts)

    def evaluate(
        self,
        system_prompt: str = "",
        user_input: str = "",
        template_id: str | None = None,
        agent_id: str = "sandbox",
        session_id: str | None = None,
    ) -> dict[str, Any]:
        """Scan the combined prompt and return the explainable result."""
        template = self.resolve_template(template_id)
        content = self.build_content(system_prompt, user_input, template)

        sid = uuid.UUID(session_id) if session_id else None
        scan = self._scanner.scan(content, session_id=sid, agent_id=agent_id)

        result = scan.to_dict()
        result["evaluated_prompt"] = content
        result["template"] = (
            {"id": template.get("id"), "name": template.get("name"), "category": template.get("category")}
            if template
            else None
        )
        return result


_evaluator: PlaygroundEvaluator | None = None


def get_playground_evaluator() -> PlaygroundEvaluator:
    global _evaluator
    if _evaluator is None:
        _evaluator = PlaygroundEvaluator()
    return _evaluator
