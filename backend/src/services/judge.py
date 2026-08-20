"""LLM-judge verifier for borderline verdicts — WS-2.3 / Phase 4.6.

When enabled (``ARTSA_JUDGE_ENABLED=true``), SUSPICIOUS (50–79) verdicts are
sent to a fast judge model for confirmation. The judge can only *raise* a
borderline verdict — it never downgrades, so a wrong judge can never let an
attack through (fail-safe by construction).

POWER CAP (Phase 4.6): the judge is not trusted until it is calibrated. It may
escalate only when a persisted calibration record (``backend/data/
judge_calibration.json``, written by the ``/benchmark/judge-validation`` run)
shows agreement >= ``ARTSA_JUDGE_MIN_AGREEMENT`` (0.85), and its influence is
bounded: it adds at most ``ARTSA_JUDGE_MAX_RAISE`` (25) points to the engine's
score, and the verdict only reaches BREACHED when the raised score actually
crosses the KILL band (>= 80). An uncalibrated judge is inert.

Any error, timeout, or unparseable answer leaves the verdict unchanged and the
call proceeds on the deterministic engine's score.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from src.core.config import settings
from src.core.models.events import ToolCallEvent
from src.core.models.scores import ContainmentVerdict, RiskScore

logger = logging.getLogger(__name__)

_JUDGE_SYSTEM = (
    "You are a security verdict judge for an AI agent containment guardrail. "
    "A deterministic engine already scored this tool call as borderline. "
    "Classify it as MALICIOUS or SAFE. Reply with exactly one word: MALICIOUS or SAFE."
)


class JudgeVerifier:
    """Optional LLM confirmation for borderline (SUSPICIOUS) verdicts."""

    def __init__(self) -> None:
        self._proxy = None  # lazy — LLMProxy pulls provider registry on use

    def _load_proxy(self):
        if self._proxy is None:
            from src.gateway.llm_proxy import LLMProxy

            self._proxy = LLMProxy()
        return self._proxy

    def _args_text(self, event: ToolCallEvent) -> str:
        if isinstance(event.arguments, dict):
            for key in (
                "command",
                "cmd",
                "input",
                "code",
                "script",
                "payload",
                "shell_command",
                "sql",
                "query",
                "statement",
                "path",
                "url",
                "tool",
                "name",
                "q",
                "content",
                "body",
            ):
                val = event.arguments.get(key)
                if isinstance(val, str):
                    return val
            return str(event.arguments)
        return str(event.arguments)

    def _call_judge(self, tool: str, args: str) -> str:
        """Sync chat-completion to the configured judge model. Returns the raw
        assistant reply text; raises on transport/HTTP errors."""
        provider = settings.ARTSA_JUDGE_PROVIDER or settings.ARTSA_DEFAULT_PROVIDER or "openai"
        model = settings.ARTSA_JUDGE_MODEL or settings.ARTSA_DEFAULT_MODEL or "gpt-4o-mini"
        proxy = self._load_proxy()
        base_url, api_key, extra_headers = proxy.resolve_target(provider)
        model = proxy.resolve_model(provider, model)

        headers = {"Content-Type": "application/json", **extra_headers}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": _JUDGE_SYSTEM},
                {
                    "role": "user",
                    "content": f"Tool: {tool}\nArguments: {args[:800]}",
                },
            ],
            "max_tokens": 8,
            "temperature": 0.0,
        }
        with httpx.Client(timeout=settings.ARTSA_JUDGE_TIMEOUT_SEC) as client:
            resp = client.post(f"{base_url}/chat/completions", headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
        return str(data["choices"][0]["message"]["content"])

    def verify(
        self, event: ToolCallEvent, risk: RiskScore, verdict: ContainmentVerdict
    ) -> tuple[RiskScore, ContainmentVerdict, dict[str, Any] | None]:
        """Confirm borderline verdicts. Returns (risk, verdict, judge_evidence);
        evidence is None when the judge was not consulted or could not confirm."""
        if not settings.ARTSA_JUDGE_ENABLED:
            return risk, verdict, None
        if verdict.verdict != "SUSPICIOUS":
            return risk, verdict, None

        tool = event.tool_name or ""
        args = self._args_text(event)
        try:
            answer = self._call_judge(tool, args).strip().upper()
        except Exception as exc:  # fail-safe: never block on judge errors
            logger.debug("Judge call failed for %s (%s) — keeping engine verdict", tool, exc)
            return risk, verdict, None

        if "MALICIOUS" not in answer:
            # SAFE / unknown: do not downgrade the engine's borderline verdict.
            return (
                risk,
                verdict,
                {
                    "judge_enabled": True,
                    "judge_response": answer[:40],
                    "judge_action": "kept_engine_verdict",
                },
            )

        # ── Phase 4.6 power cap ─────────────────────────────────────────────
        # 1. Calibration gate: an unvalidated or low-agreement judge is inert.
        from src.benchmark.judge_validation import judge_is_calibrated

        if not judge_is_calibrated():
            return (
                risk,
                verdict,
                {
                    "judge_enabled": True,
                    "judge_response": answer[:40],
                    "judge_action": "judge_not_calibrated_no_escalation",
                    "note": "judge must pass /benchmark/judge-validation (agreement >= "
                    f"{settings.ARTSA_JUDGE_MIN_AGREEMENT}) before it may escalate",
                },
            )

        # 2. Bounded influence: the judge adds at most MAX_RAISE points.
        new_score = min(100.0, risk.overall_score + settings.ARTSA_JUDGE_MAX_RAISE)
        if new_score < 80.0:
            # Capped raise stays below the KILL band — surface, don't enforce.
            new_risk = risk.model_copy(
                update={
                    "overall_score": max(risk.overall_score, new_score),
                    "flags": list(dict.fromkeys([*risk.flags, "JUDGE_RAISED"])),
                }
            )
            return (
                new_risk,
                verdict,
                {
                    "judge_enabled": True,
                    "judge_response": answer[:40],
                    "judge_action": "raised_below_kill_band",
                    "raised_to": round(new_score, 1),
                },
            )

        # 3. Confirmed + calibrated + crosses KILL: escalate.
        new_risk = risk.model_copy(
            update={
                "overall_score": max(risk.overall_score, new_score),
                "flags": list(dict.fromkeys([*risk.flags, "JUDGE_CONFIRMED"])),
            }
        )
        new_verdict = ContainmentVerdict(
            session_id=verdict.session_id,
            verdict="BREACHED",
            confidence=max(verdict.confidence, 0.92),
            reasoning=(
                f"{verdict.reasoning} | Judge verifier (model "
                f"{settings.ARTSA_JUDGE_MODEL or settings.ARTSA_DEFAULT_MODEL}) "
                f"confirmed the call as MALICIOUS; escalated to KILL."
            ),
            recommended_action="KILL",
        )
        evidence = {
            "judge_enabled": True,
            "judge_response": answer[:40],
            "judge_action": "escalated_to_kill",
            "raised_to": round(new_score, 1),
        }
        return new_risk, new_verdict, evidence
