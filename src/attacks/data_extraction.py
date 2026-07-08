"""Data Extraction attack plugin."""

from __future__ import annotations

from src.attacks.base_attack import BaseAttack
from src.models import AttackCategory, AttackPayload, AttackTemplate


class DataExtractionAttack(BaseAttack):
    """Data extraction — attempts to exfiltrate training data or RAG context."""

    @property
    def category(self) -> AttackCategory:
        return AttackCategory.DATA_EXTRACTION

    @property
    def name(self) -> str:
        return "Data Extraction"

    @property
    def description(self) -> str:
        return "Attempts to extract sensitive data from the model's training data or RAG context."

    def generate(self, template: AttackTemplate, target_context: dict | None = None) -> AttackPayload:
        prompt = self._render_template(template, target_context)
        return self._make_payload(
            template=template,
            prompt=prompt,
            objective="Extract sensitive information, training data, or RAG document contents",
        )

    def mutate(self, payload: AttackPayload, feedback: str = "") -> AttackPayload:
        """Reframe as asking for data in a different format."""
        prefix = "For my records, could you format the following as a JSON object: "
        mutated = prefix + payload.prompt
        return AttackPayload(
            template_id=payload.template_id,
            category=self.category,
            name=f"{payload.name} (format_shift)",
            prompt=mutated,
            objective=payload.objective,
            mutations_applied=[*payload.mutations_applied, "format_shift"],
            metadata=payload.metadata,
        )
