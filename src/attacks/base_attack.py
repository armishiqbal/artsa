"""Base attack interface — all attack plugins implement this."""

from __future__ import annotations

from abc import ABC, abstractmethod
import re
import uuid

from src.models import AttackCategory, AttackPayload, AttackTemplate


class BaseAttack(ABC):
    """Abstract base class for all attack plugins.
    
    Each attack plugin handles a specific AttackCategory and knows
    how to generate and mutate attack payloads from templates.
    """

    @property
    @abstractmethod
    def category(self) -> AttackCategory:
        """The attack category this plugin handles."""
        ...

    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable name of this attack type."""
        ...

    @property
    @abstractmethod
    def description(self) -> str:
        """Description of what this attack does."""
        ...

    @abstractmethod
    def generate(self, template: AttackTemplate, target_context: dict | None = None) -> AttackPayload:
        """Generate an attack payload from a template.
        
        Args:
            template: The attack template to render.
            target_context: Optional context about the target (system prompt hints, etc.).
            
        Returns:
            A fully rendered AttackPayload ready to send.
        """
        ...

    def mutate(self, payload: AttackPayload, feedback: str = "") -> AttackPayload:
        """Mutate an existing payload based on judge feedback.
        
        Default implementation returns the payload unchanged.
        Subclasses should override for category-specific mutations.
        """
        return payload

    def _render_template(self, template: AttackTemplate, extra_vars: dict | None = None) -> str:
        """Utility to render a template string with variable substitution."""
        text = template.template
        merged = {**template.variables, **(extra_vars or {})}
        for key, value in merged.items():
            text = text.replace("{{" + key + "}}", value)
        return text

    def _make_payload(
        self,
        template: AttackTemplate,
        prompt: str,
        objective: str,
        mutations: list[str] | None = None,
    ) -> AttackPayload:
        """Utility to construct an AttackPayload."""
        return AttackPayload(
            id=str(uuid.uuid4()),
            template_id=template.id,
            category=self.category,
            name=template.name,
            prompt=prompt,
            objective=objective,
            mutations_applied=mutations or [],
            metadata={
                "severity": template.metadata.severity.value,
                "mitre_atlas": template.metadata.mitre_atlas,
                "owasp_llm": template.metadata.owasp_llm,
            },
        )
