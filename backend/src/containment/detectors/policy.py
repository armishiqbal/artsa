"""Org-policy containment detector — WS-2.4 (policy knowledge → scoring).

Loads organization policy rules (``configs/org_policies/default.yaml``,
extended with optional per-rule ``tool`` scoping) and evaluates every tool call
against them as a first-class detector with its own score channel
(``policy_score``). Violations carry the matched rule's name and description as
evidence, so operators and auditors see *which policy clause* decided the
verdict — the "policy-aware guardrail" promise made real.

Optional semantic corroboration: when ``ARTSA_POLICY_RAG_SCORING=true`` the
detector queries the RAG policy store for clauses semantically related to the
call and adds a small boost when a violation-style clause is retrieved.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from pathlib import Path

import yaml

from src.containment.detectors.base import BaseDetector
from src.core.config import settings
from src.core.models.events import SecurityEvent, ToolCallEvent

logger = logging.getLogger(__name__)

# Retrieved clauses that sound like a restriction — used only for the opt-in
# RAG corroboration path.
_VIOLATION_MARKERS = ("must not", "must never", "forbidden", "prohibited", "restrict", "block", "deny", "never access", "never call", "do not")


@dataclass(frozen=True)
class PolicyRule:
    name: str
    pattern: str
    event_type: str = "POLICY_VIOLATION"
    severity: str = "HIGH"
    risk_score: float = 75.0
    description: str = ""
    tool: str | None = None


def load_policy_rules(path: str | Path | None = None) -> list[PolicyRule]:
    """Load org-policy rules from YAML (optional per-rule ``tool`` scoping)."""
    if path is None:
        backend_dir = Path(__file__).resolve().parent.parent.parent.parent
        path = backend_dir / "configs" / "org_policies" / "default.yaml"
    policy_path = Path(path)
    if not policy_path.exists():
        return []

    with policy_path.open(encoding="utf-8") as f:
        data: dict = yaml.safe_load(f) or {}

    rules: list[PolicyRule] = []
    for rule in data.get("rules", []):
        rules.append(
            PolicyRule(
                name=str(rule.get("name", "unnamed_policy")),
                pattern=str(rule["pattern"]),
                event_type=str(rule.get("event_type", "POLICY_VIOLATION")),
                severity=str(rule.get("severity", "HIGH")),
                risk_score=float(rule.get("risk_score", 75.0)),
                description=str(rule.get("description", rule.get("name", ""))),
                tool=str(rule["tool"]).lower() if rule.get("tool") else None,
            )
        )
    return rules


def _args_text(event: ToolCallEvent) -> str:
    if isinstance(event.arguments, dict):
        for key in ("command", "cmd", "input", "code", "script", "payload",
                    "shell_command", "sql", "query", "statement", "path",
                    "url", "tool", "name", "q", "content", "body"):
            val = event.arguments.get(key)
            if isinstance(val, str):
                return val
        return str(event.arguments)
    return str(event.arguments)


class PolicyDetector(BaseDetector):
    """Evaluates org-policy rules against tool calls (WS-2.4)."""

    def __init__(self, policy_path: str | Path | None = None) -> None:
        super().__init__(name="PolicyDetector")
        path = policy_path or settings.ARTSA_ORG_POLICY_PATH or None
        self._rules = load_policy_rules(path)
        self._retriever = None  # lazy, only when ARTSA_POLICY_RAG_SCORING=true
        logger.info("PolicyDetector loaded %d org-policy rule(s)", len(self._rules))

    def _rag_corroboration(self, args_text: str) -> dict | None:
        """Opt-in: retrieve policy clauses semantically related to the call and
        return corroboration evidence when a violation-style clause matches."""
        if not settings.ARTSA_POLICY_RAG_SCORING:
            return None
        try:
            if self._retriever is None:
                from src.agents.rag.retriever import RAGRetriever

                self._retriever = RAGRetriever(top_k=3)
            chunks = self._retriever.retrieve(args_text[:500])
            for chunk in chunks:
                low = chunk.text.lower()
                if chunk.score >= 0.8 and any(m in low for m in _VIOLATION_MARKERS):
                    return {
                        "rag_clause_id": chunk.id,
                        "rag_clause_source": chunk.source,
                        "rag_similarity": round(chunk.score, 4),
                    }
        except Exception as exc:  # pragma: no cover - optional path must never break ingest
            logger.debug("RAG policy corroboration skipped: %s", exc)
        return None

    def detect(self, event: ToolCallEvent) -> SecurityEvent | None:
        args_text = _args_text(event)
        tool = (event.tool_name or "").lower()
        best: PolicyRule | None = None
        for rule in self._rules:
            if rule.tool and rule.tool != tool:
                continue
            try:
                if re.search(rule.pattern, args_text, re.IGNORECASE) and (
                    best is None or rule.risk_score > best.risk_score
                ):
                    best = rule
            except re.error as exc:  # pragma: no cover - malformed policy file
                logger.warning("Policy rule %s has invalid regex: %s", rule.name, exc)

        if best is None:
            return None

        risk_score = min(100.0, best.risk_score)
        evidence: dict = {
            "policy_rule": best.name,
            "policy_description": best.description,
            "policy_source": "org_policies",
        }
        rag = self._rag_corroboration(args_text)
        if rag:
            risk_score = min(100.0, risk_score + 4.0)
            evidence["rag_policy_corroboration"] = rag

        return SecurityEvent(
            session_id=event.session_id,
            agent_id=event.agent_id,
            event_type=best.event_type,
            severity=best.severity,
            risk_score=risk_score,
            description=(
                f"Org policy violation: {best.description or best.name} "
                f"(rule '{best.name}')"
            ),
            evidence=evidence,
            detector=self.name,
        )
