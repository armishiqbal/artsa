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
