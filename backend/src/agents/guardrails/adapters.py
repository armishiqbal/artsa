"""Pluggable guardrail adapter registry for target agent defense pipeline."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

from src.models import GuardrailLayer, GuardrailResult


@dataclass
class GuardrailContext:
    text: str
    direction: str = "input"  # input | output
    metadata: dict = field(default_factory=dict)


class GuardrailAdapter(Protocol):
    name: str
    layer: GuardrailLayer

    def check(self, ctx: GuardrailContext) -> GuardrailResult:
        ...


class HeuristicInputFilter:
    name = "heuristic_input"
    layer = GuardrailLayer.INPUT_FILTER

    BLOCK_PATTERNS = (
        "banned_word",
        "ignore previous instructions",
        "system override",
        "[system override",
        "jailbreak",
        "you are now dan",
    )

    def check(self, ctx: GuardrailContext) -> GuardrailResult:
        lower = ctx.text.lower()
        hit = next((p for p in self.BLOCK_PATTERNS if p in lower), None)
        return GuardrailResult(
            layer=self.layer,
            passed=hit is None,
            details="Passed heuristic input filter" if hit is None else f"Blocked pattern: {hit}",
        )


class HeuristicInjectionDetector:
    name = "heuristic_injection"
    layer = GuardrailLayer.SYSTEM_PROMPT

    INJECTION_MARKERS = (
        "ignore previous",
        "disregard all",
        "new instructions:",
        "developer mode",
        "sudo mode",
    )

    def check(self, ctx: GuardrailContext) -> GuardrailResult:
        lower = ctx.text.lower()
        hit = next((m for m in self.INJECTION_MARKERS if m in lower), None)
        return GuardrailResult(
            layer=self.layer,
            passed=hit is None,
            details="No injection detected" if hit is None else f"Injection marker: {hit}",
        )


class HeuristicOutputFilter:
    name = "heuristic_output"
    layer = GuardrailLayer.OUTPUT_FILTER

    TOXIC_MARKERS = ("kill all users", "rm -rf /", "drop database", "delete from users")

    def check(self, ctx: GuardrailContext) -> GuardrailResult:
        lower = ctx.text.lower()
        hit = next((m for m in self.TOXIC_MARKERS if m in lower), None)
        return GuardrailResult(
            layer=self.layer,
            passed=hit is None,
            details="Output passed toxicity check" if hit is None else f"Blocked toxic output: {hit}",
        )


class ExternalSafetyAdapter:
    """Optional external guardrail API integration when EXTERNAL_GUARD_API_KEY is configured."""

    name = "external_safety"
    layer = GuardrailLayer.INPUT_FILTER

    def __init__(self) -> None:
        from src.core.config import settings
        self.api_key = getattr(settings, "EXTERNAL_GUARD_API_KEY", None) or getattr(settings, "LAKERA_API_KEY", None)
        self.base_url = (getattr(settings, "EXTERNAL_GUARD_BASE_URL", None) or getattr(settings, "LAKERA_BASE_URL", None) or "https://api.artsa.security/v1").rstrip("/")

    def check(self, ctx: GuardrailContext) -> GuardrailResult:
        if not self.api_key:
            return GuardrailResult(
                layer=self.layer,
                passed=True,
                details="External safety guard skipped (no API key configured)",
            )
        try:
            import json
            import urllib.request

            payload = json.dumps({"input": ctx.text}).encode()
            req = urllib.request.Request(
                f"{self.base_url}/guard",
                data=payload,
                headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=3) as resp:
                data = json.loads(resp.read().decode())
            flagged = bool(data.get("flagged") or data.get("results", {}).get("flagged"))
            return GuardrailResult(
                layer=self.layer,
                passed=not flagged,
                details="External safety: clean" if not flagged else "External safety: flagged",
            )
        except Exception as exc:
            return GuardrailResult(
                layer=self.layer,
                passed=True,
                details=f"External safety unavailable, fail-open: {exc}",
            )


# Backwards compatibility alias
LakeraGuardAdapter = ExternalSafetyAdapter


class OrgPolicyGuardrailAdapter:
    """Evaluates input prompts against active org policy rules, including Defender patches."""

    name = "org_policy"
    layer = GuardrailLayer.INPUT_FILTER

    def __init__(self, policy_path: Any = None) -> None:
        if policy_path is None:
            from pathlib import Path
            self.policy_path = (
                Path(__file__).resolve().parent.parent.parent.parent
                / "configs"
                / "org_policies"
                / "default.yaml"
            )
        else:
            from pathlib import Path
            self.policy_path = Path(policy_path)

    def _load_rules(self) -> list[dict]:
        if not self.policy_path.exists():
            return []
        try:
            import yaml
            with self.policy_path.open(encoding="utf-8") as f:
                data = yaml.safe_load(f) or {}
            return data.get("rules", [])
        except Exception:
            return []

    def check(self, ctx: GuardrailContext) -> GuardrailResult:
        import re
        rules = self._load_rules()
        for rule in rules:
            pattern = rule.get("pattern")
            if not pattern:
                continue
            try:
                if re.search(pattern, ctx.text):
                    rule_name = rule.get("name", "unnamed_rule")
                    return GuardrailResult(
                        layer=self.layer,
                        passed=False,
                        details=f"Blocked by active org policy rule: {rule_name}",
                    )
            except re.error:
                continue
        return GuardrailResult(
            layer=self.layer,
            passed=True,
            details="Passed active org policy rules",
        )


class AzureContentSafetyAdapter:
    """Optional Azure AI Content Safety when AZURE_CONTENT_SAFETY_KEY is set."""

    name = "azure_content_safety"
    layer = GuardrailLayer.OUTPUT_FILTER

    def __init__(self) -> None:
        from src.core.config import settings
        self.api_key = settings.AZURE_CONTENT_SAFETY_KEY
        self.endpoint = settings.AZURE_CONTENT_SAFETY_ENDPOINT or "https://contentsafety.cognitiveservices.azure.com"

    def check(self, ctx: GuardrailContext) -> GuardrailResult:
        if not self.api_key:
            return GuardrailResult(
                layer=self.layer,
                passed=True,
                details="Azure Content Safety skipped (no AZURE_CONTENT_SAFETY_KEY)",
            )
        try:
            import json
            import urllib.request

            url = f"{self.endpoint.rstrip('/')}/contentsafety/text:analyze?api-version=2024-09-01"
            payload = json.dumps({"text": ctx.text, "categories": ["Hate", "Violence", "SelfHarm", "Sexual"]}).encode()
            req = urllib.request.Request(
                url,
                data=payload,
                headers={"Ocp-Apim-Subscription-Key": self.api_key, "Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=3) as resp:
                data = json.loads(resp.read().decode())
            blocked = any(
                (item.get("severity") or 0) >= 4
                for item in data.get("categoriesAnalysis", [])
            )
            return GuardrailResult(
                layer=self.layer,
                passed=not blocked,
                details="Azure Content Safety: clean" if not blocked else "Azure Content Safety: high severity",
            )
        except Exception as exc:
            return GuardrailResult(
                layer=self.layer,
                passed=True,
                details=f"Azure Content Safety unavailable, fail-open: {exc}",
            )


def get_input_adapters() -> list[GuardrailAdapter]:
    return [OrgPolicyGuardrailAdapter(), HeuristicInputFilter(), HeuristicInjectionDetector(), ExternalSafetyAdapter()]


def get_output_adapters() -> list[GuardrailAdapter]:
    return [HeuristicOutputFilter(), AzureContentSafetyAdapter()]
