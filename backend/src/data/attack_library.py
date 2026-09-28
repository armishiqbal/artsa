"""Attack template library loader and selector."""

from __future__ import annotations

import json
import random
from pathlib import Path

from src.data.vector_store import VectorStoreManager
from src.models import AttackCategory, AttackTemplate


class AttackLibrary:
    """Loads attack templates from JSON files and serves category queries."""

    def __init__(self, library_dir: str, vector_store: VectorStoreManager | None = None) -> None:
        self.library_dir = Path(library_dir)
        self.vector_store = vector_store
        self._templates: dict[str, AttackTemplate] = {}
        self._by_category: dict[AttackCategory, list[AttackTemplate]] = {}

    def load_from_directory(self) -> int:
        templates: list[AttackTemplate] = []
        for path in self.library_dir.rglob("*.json"):
            with path.open(encoding="utf-8") as file_obj:
                payload = json.load(file_obj)
            rows = payload if isinstance(payload, list) else [payload]
            for row in rows:
                template = AttackTemplate.model_validate(row)
                templates.append(template)
                self._templates[template.id] = template
                self._by_category.setdefault(template.category, []).append(template)

        if self.vector_store:
            self.vector_store.upsert_templates(templates)
        return len(templates)

    def get_random_attack(self, category: AttackCategory) -> AttackTemplate:
        items = self._by_category.get(category, [])
        if not items:
            raise ValueError(f"No attack templates available for category {category.value}")
        return random.choice(items)

    def get_by_id(self, template_id: str) -> AttackTemplate | None:
        return self._templates.get(template_id)

    def add_template(self, template: AttackTemplate) -> None:
        """Register a single attack template into the library."""
        self._templates[template.id] = template
        cat_list = self._by_category.setdefault(template.category, [])
        if not any(t.id == template.id for t in cat_list):
            cat_list.append(template)
        if self.vector_store:
            self.vector_store.upsert_templates([template])

    def add_templates(self, templates: list[AttackTemplate]) -> int:
        """Register multiple attack templates into the library."""
        count = 0
        for t in templates:
            self.add_template(t)
            count += 1
        return count

    def list_templates(self, category: AttackCategory | None = None) -> list[AttackTemplate]:
        """List all templates or filter by category."""
        if category is not None:
            return list(self._by_category.get(category, []))
        return list(self._templates.values())

