"""Direct Prompt Injection attack plugin."""

from __future__ import annotations

from src.attacks.base_attack import BaseAttack
from src.models import AttackCategory, AttackPayload, AttackTemplate


class PromptInjectionAttack(BaseAttack):
    """Direct prompt injection — attempts to override the target's instructions."""

    @property
    def category(self) -> AttackCategory:
        return AttackCategory.PROMPT_INJECTION

    @property
    def name(self) -> str:
        return "Direct Prompt Injection"

    @property
    def description(self) -> str:
        return "Manipulates the LLM by injecting instructions that override the system prompt."

    def generate(self, template: AttackTemplate, target_context: dict | None = None) -> AttackPayload:
        prompt = self._render_template(template, target_context)
        return self._make_payload(
            template=template,
            prompt=prompt,
            objective="Override the target's system instructions and make it follow injected directives",
        )

    def mutate(self, payload: AttackPayload, feedback: str = "") -> AttackPayload:
        """Mutate by adding distraction text and reformatting."""
        # Add prefix distraction
        prefix = "I have a quick question about my portfolio. Actually, before that — "
        mutated_prompt = prefix + payload.prompt
        
        return AttackPayload(
            template_id=payload.template_id,
            category=self.category,
            name=f"{payload.name} (mutated)",
            prompt=mutated_prompt,
            objective=payload.objective,
            mutations_applied=[*payload.mutations_applied, "prefix_distraction"],
            metadata=payload.metadata,
        )
