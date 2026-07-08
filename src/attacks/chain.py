"""Multi-turn attack chains — sequential attack steps that build on each other."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any

from src.models import AttackCategory, AttackPayload, AttackTemplate


@dataclass
class AttackChain:
    """A multi-turn attack sequence where each step builds on the previous response.

    Used primarily for social engineering attacks where trust must be built
    over multiple interactions before the actual exploit is delivered.

    Usage:
        chain = AttackChain.from_template(template)
        while not chain.is_complete():
            payload = chain.current_payload()
            response = target.process_with_history(payload.prompt, chain.conversation_history)
            chain.advance(response_text=response.response)
        # Judge evaluates the final interaction
    """

    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    category: AttackCategory = AttackCategory.SOCIAL_ENGINEERING
    name: str = ""
    objective: str = ""
    template_id: str = ""

    turns: list[str] = field(default_factory=list)  # Raw prompt strings per turn
    current_turn: int = 0
    conversation_history: list[dict[str, str]] = field(default_factory=list)

    # Metadata from the template
    metadata: dict[str, Any] = field(default_factory=dict)

    TURN_DELIMITER: str = "---TURN---"

    @classmethod
    def from_template(
        cls,
        template: AttackTemplate,
        variables: dict[str, str] | None = None,
    ) -> AttackChain:
        """Create an attack chain from a template with turn delimiters.

        Templates can contain multiple turns separated by '---TURN---'.
        Single-turn templates are also supported (becomes a 1-step chain).
        """
        # Render variables
        rendered = template.template
        merged_vars = {**template.variables, **(variables or {})}
        for key, value in merged_vars.items():
            rendered = rendered.replace("{{" + key + "}}", value)

        # Split on turn delimiter
        if cls.TURN_DELIMITER in rendered:
            turns = [t.strip() for t in rendered.split(cls.TURN_DELIMITER) if t.strip()]
        else:
            turns = [rendered.strip()]

        return cls(
            category=template.category,
            name=template.name,
            objective=f"Multi-turn {template.category.value}: {template.name}",
            template_id=template.id,
            turns=turns,
            metadata={
                "severity": template.metadata.severity.value,
                "mitre_atlas": template.metadata.mitre_atlas,
                "owasp_llm": template.metadata.owasp_llm,
                "total_turns": len(turns),
            },
        )

    def is_multi_turn(self) -> bool:
        """Return True if this chain has more than one turn."""
        return len(self.turns) > 1

    def is_complete(self) -> bool:
        """Return True if all turns have been executed."""
        return self.current_turn >= len(self.turns)

    def current_payload(self) -> AttackPayload:
        """Get the current turn's attack payload."""
        if self.is_complete():
            raise StopIteration("Attack chain is complete.")

        prompt = self.turns[self.current_turn]

        return AttackPayload(
            id=str(uuid.uuid4()),
            template_id=self.template_id,
            category=self.category,
            name=f"{self.name} [Turn {self.current_turn + 1}/{len(self.turns)}]",
            prompt=prompt,
            objective=self.objective,
            metadata={
                **self.metadata,
                "chain_id": self.id,
                "turn": self.current_turn + 1,
                "total_turns": len(self.turns),
                "is_multi_turn": self.is_multi_turn(),
            },
        )

    def advance(self, response_text: str) -> None:
        """Record the target's response and advance to the next turn.

        The conversation history is accumulated so the target agent
        can see the full context of the multi-turn interaction.
        """
        current_prompt = self.turns[self.current_turn]
        self.conversation_history.append(
            {"role": "user", "content": current_prompt}
        )
        self.conversation_history.append(
            {"role": "assistant", "content": response_text}
        )
        self.current_turn += 1

    @property
    def total_turns(self) -> int:
        return len(self.turns)

    @property
    def remaining_turns(self) -> int:
        return max(0, len(self.turns) - self.current_turn)
