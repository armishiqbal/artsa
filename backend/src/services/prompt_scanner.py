"""Shared prompt-content risk scanning service.

Used by the LLM reverse proxy (Phase 1) and the Attack Sandbox (Phase 3) to
evaluate raw prompt payloads through the full multi-detector containment
engine. Produces a serializable scan result including per-layer scores, fired
detectors, security events, and token-level trigger highlights for
explainability.

Scoring always comes from the real containment detectors (semantic embedding
similarity, statistical anomalies, goal drift, rule based). The keyword
highlights are a *display-only* attribution layer that surfaces known trigger
phrases so operators can see exactly which text drove the risk.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any

from src.containment.engine import ContainmentEngine
from src.core.models.events import SecurityEvent, ToolCallEvent
from src.core.models.scores import ContainmentVerdict, RiskScore

# Trigger phrases surfaced for token-level explainability. These mirror the
# semantic detector's malicious phrase bank plus well-known public jailbreak
# markers. Used ONLY for highlight/attribution display, never for scoring.
TRIGGER_PHRASES: tuple[str, ...] = (
    "ignore all previous instructions",
    "ignore previous instructions",
    "ignore all instructions",
    "ignore any previous instructions",
    "disregard your guidelines",
    "disregard all previous instructions",
    "disregard prior instructions",
    "forget your guidelines",
    "forget all instructions",
    "reveal your system prompt",
    "system prompt",
    "system override",
    "disable safety filters",
    "disable all safety protocols",
    "disable content policy",
    "developer mode",
    "do anything now",
    "do anything now (dan)",
    "dan mode",
    "no restrictions",
    "no rules",
    "no limitations",
    "jailbreak",
    "bypass content policy",
    "bypass safety",
    "exfiltrate",
    "output secrets",
    "print your instructions",
    "output your instructions",
    "show your prompt",
)


@dataclass
class TriggerHighlight:
    """A matched trigger phrase with its character span in the source content."""

    phrase: str
    start: int
    end: int

    def to_dict(self) -> dict[str, Any]:
        return {"phrase": self.phrase, "start": self.start, "end": self.end}


@dataclass
class PromptScanResult:
    """Serializable result of a prompt content scan."""

    content: str
    risk: RiskScore
    verdict: ContainmentVerdict
    security_events: list[SecurityEvent]
    fired_detectors: dict[str, bool]
    layer_scores: dict[str, float]
    highlights: list[TriggerHighlight] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "content": self.content,
            "risk_score": self.risk.overall_score,
            "risk_breakdown": {
                "rule_based": self.risk.rule_based_score,
                "statistical": self.risk.statistical_score,
                "semantic": self.risk.semantic_score,
                "goal_drift": self.risk.goal_drift_score,
            },
            "layer_scores": self.layer_scores,
            "flags": list(self.risk.flags),
            "verdict": self.verdict.verdict,
            "confidence": self.verdict.confidence,
            "reasoning": self.verdict.reasoning,
            "recommended_action": self.verdict.recommended_action,
            "fired_detectors": self.fired_detectors,
            "security_events": [
                {
                    "event_type": e.event_type,
                    "severity": e.severity,
                    "risk_score": e.risk_score,
                    "description": e.description,
                    "evidence": e.evidence,
                    "detector": e.detector,
                }
                for e in self.security_events
            ],
            "highlights": [h.to_dict() for h in self.highlights],
        }


def find_trigger_highlights(content: str) -> list[TriggerHighlight]:
    """Locate known trigger phrases in ``content`` (case-insensitive).

    Returns non-overlapping spans, preferring the longest match at each
    position so nested phrases (e.g. "ignore all previous instructions" inside
    "ignore all instructions") collapse into a single highlight.
    """
    if not content:
        return []

    lower = content.lower()
    candidates: list[TriggerHighlight] = []
    for phrase in TRIGGER_PHRASES:
        start = 0
        while True:
            idx = lower.find(phrase, start)
            if idx == -1:
                break
            candidates.append(TriggerHighlight(phrase=phrase, start=idx, end=idx + len(phrase)))
            start = idx + len(phrase)

    if not candidates:
        return []

    # Greedy longest-match, non-overlapping selection.
    candidates.sort(key=lambda h: (h.start, -(h.end - h.start)))
    selected: list[TriggerHighlight] = []
    last_end = -1
    for cand in candidates:
        if cand.start >= last_end:
            selected.append(cand)
            last_end = cand.end
    return selected


class PromptScanner:
    """Runs the multi-detector containment engine against raw prompt text."""

    def __init__(self, engine: ContainmentEngine | None = None) -> None:
        self._engine = engine or ContainmentEngine()
        # Tier-1 fast pass: deterministic prompt-injection / jailbreak rules run
        # before the statistical/semantic layers. Only active in this scanning
        # context (proxy + sandbox) — the ingest engine is untouched.
        from src.containment.detectors.prompt_injection import PromptInjectionDetector

        # Chat scope: the main engine registers a tool-scoped instance that
        # labels tool-argument injection TOOL_PROMPT_INJECTION. Here we swap in
        # a chat-scoped instance so prompts stay PROMPT_INJECTION/JAILBREAK.
        self._engine.detectors = [
            d for d in self._engine.detectors if d.name != "PromptInjectionDetector"
        ]
        self._engine.detectors.insert(0, PromptInjectionDetector())

    def scan(
        self,
        content: str,
        *,
        session_id: uuid.UUID | None = None,
        agent_id: str = "artsa-proxy",
        tool_name: str = "llm_chat",
    ) -> PromptScanResult:
        """Evaluate prompt content and return a full scan result."""
        event = ToolCallEvent(
            session_id=session_id or uuid.uuid4(),
            agent_id=agent_id,
            tool_name=tool_name,
            arguments={"prompt": content},
        )

        risk, verdict, sec_events, fired = self._engine.evaluate_with_attribution(event)
        # The engine's fired map covers its stock detectors; add the fast-pass
        # detector's status explicitly.
        fired["PromptInjectionDetector"] = any(
            e.detector == "PromptInjectionDetector" for e in sec_events
        )

        layer_scores = {
            "prompt_injection": risk.overall_score if fired["PromptInjectionDetector"] else 0.0,
            "rule_based": risk.rule_based_score if fired.get("RuleBasedDetector") else 0.0,
            "statistical": risk.statistical_score if fired.get("StatisticalDetector") else 0.0,
            "semantic": risk.semantic_score if fired.get("SemanticDetector") else 0.0,
            "goal_drift": risk.goal_drift_score if fired.get("GoalDriftDetector") else 0.0,
            "trajectory": risk.overall_score if fired.get("TrajectoryDetector") else 0.0,
        }

        return PromptScanResult(
            content=content,
            risk=risk,
            verdict=verdict,
            security_events=sec_events,
            fired_detectors=fired,
            layer_scores=layer_scores,
            highlights=find_trigger_highlights(content),
        )


_scanner: PromptScanner | None = None


def get_prompt_scanner() -> PromptScanner:
    """Process-wide singleton scanner (engines are stateless per evaluation)."""
    global _scanner
    if _scanner is None:
        _scanner = PromptScanner()
    return _scanner


def normalize_message_content(content: Any) -> str:
    """Flatten OpenAI-style message content (str | list of parts) to plain text."""
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for part in content:
            if isinstance(part, str):
                parts.append(part)
            elif isinstance(part, dict):
                if part.get("type") == "text":
                    parts.append(str(part.get("text", "")))
                else:
                    parts.append(str(part.get("text", "") or part.get("content", "")))
        return "\n".join(p for p in parts if p)
    return str(content)
