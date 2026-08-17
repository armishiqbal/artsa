"""Fast-pass deterministic prompt-injection rule detector.

Classic direct & indirect prompt injection, jailbreak, and system prompt
extraction markers matched with regular expressions over the prompt argument.
This is the Tier-1 fast pass of the hybrid guardrail architecture:
sub-millisecond, deterministic, and fully offline.

It is wired into the ``PromptScanner`` context (LLM reverse proxy and Attack
Sandbox) rather than the tool-call ingest engine, so ingest scoring semantics
are unchanged for existing consumers.
"""

from __future__ import annotations

import re

from src.containment.detectors.base import BaseDetector
from src.core.models.events import SecurityEvent, ToolCallEvent

# (regex, event_type, risk_score, description) — scores tuned to land in the
# SUSPICIOUS (>=50) / BREACHED (>=80) bands so verdicts stay actionable.
INJECTION_PATTERNS: list[tuple[str, str, float, str]] = [
    (
        r"(?i)ignore\s+(all|any|previous|prior|your|the|past)?\s*(previous|prior|past|earlier)?\s*(instructions?|guidelines?|rules?|guidance)",
        "PROMPT_INJECTION",
        80.0,
        "Instruction override attempt (ignore previous instructions)",
    ),
    (
        r"(?i)disregard\s+(all|any|previous|prior|your|the)?\s*(previous|prior|earlier)?\s*(guidelines?|instructions?|rules?)",
        "PROMPT_INJECTION",
        78.0,
        "Instruction override attempt (disregard guidelines)",
    ),
    (
        r"(?i)forget\s+(all|any|previous|prior|your)?\s*(guidelines?|instructions?|rules?|prompt)",
        "PROMPT_INJECTION",
        80.0,
        "Instruction erasure attempt (forget guidelines)",
    ),
    (
        r"(?i)(reveal|print|output|show|display|leak|extract)\s+(your|the|hidden|system)\s+(system\s+)?prompt",
        "PROMPT_INJECTION",
        86.0,
        "System prompt extraction attempt",
    ),
    (
        r"(?i)system\s+(prompt|instructions?)\s*(override|injection|replacement)",
        "PROMPT_INJECTION",
        88.0,
        "System prompt override / injection marker",
    ),
    (
        r"(?i)disable\s+(safety\s+filters?|guardrails?|content\s+policy|moderation|restrictions?)",
        "JAILBREAK",
        90.0,
        "Safety filter disable attempt",
    ),
    (
        r"(?i)bypass\s+(safety|content\s+policy|guardrails?|the\s+rules?)",
        "JAILBREAK",
        86.0,
        "Guardrail bypass attempt",
    ),
    (
        r"(?i)(developer\s+mode|dan\s+mode|do\s+anything\s+now|jailbreak)",
        "JAILBREAK",
        92.0,
        "Jailbreak technique (DAN / unrestricted mode)",
    ),
    (
        r"(?i)you\s+are\s+now\s+(in\s+)?(developer\s+mode|without|with\s+no)\s+(restrictions?|limitations?|filters?)",
        "JAILBREAK",
        90.0,
        "Persona / restriction override",
    ),
    (
        r"(?i)no\s+(restrictions?|limitations?|rules?|filters?)\s*(apply|anymore|whatsoever)?",
        "JAILBREAK",
        72.0,
        "Unrestricted-mode assertion",
    ),
    (
        r"(?i)(output|reveal|exfiltrate|leak|print|show|display|extract|send)\s+(the|your|our|any|all|admin)?\s*(\w+\s+)?(secrets?|passwords?|api\s+keys?|credentials?|pii|internal\s+data|database\s+password|access\s+keys?)",
        "CREDENTIAL_THEFT",
        88.0,
        "Sensitive data exfiltration request",
    ),
    (
        r"(?i)(previous|earlier)\s+(conversation|context).{0,40}(summarize|repeat|ignore|forget)",
        "PROMPT_INJECTION",
        74.0,
        "Context hijacking attempt",
    ),
    (
        r"(?i)(output|reveal|print|show|display|leak|extract)\s+(your|the|hidden)\s+(full|complete|entire)\s+(configuration|system\s+prompt|instructions?)",
        "PROMPT_INJECTION",
        86.0,
        "System prompt extraction attempt (intervening words)",
    ),
    (
        r"(?i)(new|updated|priority|admin|system)\s+(priority\s+|system\s+)?(override|directive|instructions?\s+from)",
        "PROMPT_INJECTION",
        88.0,
        "Authority override framing (system override / new directive)",
    ),
    (
        r"(?i)bypass\s+(all|any|every|these|the|our)?\s*(restrictions?|filters?|rules?|controls?|protocols?|policies?)",
        "JAILBREAK",
        86.0,
        "Guardrail bypass attempt (generic restrictions)",
    ),
    (
        r"(?i)(without|with\s+no)\s+(any\s+|content\s+)?(restrictions?|limitations?|filters?|guardrails?|safety\s+(guidelines?|rules?))",
        "JAILBREAK",
        82.0,
        "Unrestricted-mode assertion (without/with no)",
    ),
    (
        r"(?i)(maintenance|admin|root|god)\s+(mode|access|session)",
        "JAILBREAK",
        80.0,
        "Privileged role / mode framing",
    ),
    # ── Paraphrased / legacy-override injections (catch reworded attempts) ──
    (
        r"(?i)ignore\s+(past|earlier|my|all)\s+(guidance|directives?|guidelines?|teachings?|prompts?)",
        "PROMPT_INJECTION",
        76.0,
        "Instruction override attempt (paraphrased guidance)",
    ),
    (
        r"(?i)(override|replace|redefine)\s+(the\s+|our\s+|current\s+)?safety\s+(policy|rules?|guardrails?|guidelines?)",
        "PROMPT_INJECTION",
        80.0,
        "Safety policy override / redefinition attempt",
    ),
    (
        r"(?i)follow\s+my\s+instructions?\s+(?:instead|now|from\s+now)",
        "PROMPT_INJECTION",
        74.0,
        "Instruction re-prioritization frame",
    ),
]


class PromptInjectionDetector(BaseDetector):
    """Deterministic regex detector for prompt injection / jailbreak markers.

    ``tool_scope=True`` re-labels ``PROMPT_INJECTION`` matches as
    ``TOOL_PROMPT_INJECTION`` for tool-call-argument injection in the main
    containment engine, keeping the chat-layer ``PromptScanner`` on the
    original ``PROMPT_INJECTION`` type. Jailbreak matches stay ``JAILBREAK``
    in both scopes.
    """

    def __init__(self, tool_scope: bool = False) -> None:
        super().__init__(name="PromptInjectionDetector")
        self.tool_scope = tool_scope
        self.PATTERNS = INJECTION_PATTERNS

    def detect(self, event: ToolCallEvent) -> SecurityEvent | None:
        combined_text = str(event.arguments)
        # Select the highest-scoring pattern match so a payload carrying multiple
        # injection signals (e.g. "ignore previous instructions AND reveal system
        # prompt") is scored by its strongest signal, not the first regex hit.
        best: tuple[float, re.Match[str], str, str] | None = (
            None  # (score, match, event_type, desc)
        )
        for pattern, event_type, risk_score, desc in self.PATTERNS:
            match = re.search(pattern, combined_text)
            if match and (best is None or risk_score > best[0]):
                best = (risk_score, match, event_type, desc)
        if best is None:
            return None
        risk_score, match, event_type, desc = best
        if self.tool_scope and event_type == "PROMPT_INJECTION":
            event_type = "TOOL_PROMPT_INJECTION"
        return SecurityEvent(
            session_id=event.session_id,
            agent_id=event.agent_id,
            event_type=event_type,
            severity="CRITICAL" if risk_score >= 80 else "HIGH",
            risk_score=risk_score,
            description=desc,
            evidence={
                "matched_pattern": desc,
                "matched_text": match.group(0),
                "tool": event.tool_name,
                "span": [match.start(), match.end()],
            },
            detector=self.name,
        )
