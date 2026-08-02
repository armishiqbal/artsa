"""Lightweight vector store for attack template indexing with optional Chroma persistence."""

from __future__ import annotations

import logging
from pathlib import Path

from src.models import AttackTemplate

logger = logging.getLogger(__name__)

ATTACK_COLLECTION = "artsa_attack_library"


class VectorStoreManager:
    """Attack template store — in-memory with optional ChromaDB persistence."""

    def __init__(self, persist_dir: str) -> None:
        from src.core.config import settings

        self.persist_dir = Path(persist_dir)
        self.persist_dir.mkdir(parents=True, exist_ok=True)
        self._templates: dict[str, AttackTemplate] = {}
        self._results: list[dict] = []
        self._collection = None

        if settings.USE_CHROMA_RAG and not settings.is_testing:
            try:
                import chromadb

                client = chromadb.PersistentClient(path=str(self.persist_dir))
                self._collection = client.get_or_create_collection(name=ATTACK_COLLECTION)
                logger.info("Attack library using Chroma collection %s", ATTACK_COLLECTION)
            except Exception as exc:
                logger.warning("Chroma attack store unavailable, using in-memory: %s", exc)

    def upsert_templates(self, templates: list[AttackTemplate]) -> None:
        for template in templates:
            self._templates[template.id] = template

        if self._collection is None or not templates:
            return

        ids = [t.id for t in templates]
        documents = [f"{t.name}\n{t.description}\n{t.template}" for t in templates]
        metadatas = [
            {
                "category": t.category.value if hasattr(t.category, "value") else str(t.category),
                "name": t.name,
            }
            for t in templates
        ]
        self._collection.upsert(ids=ids, documents=documents, metadatas=metadatas)

    def log_attack_result(
        self,
        attack_id: str,
        template_id: str,
        success: bool,
        score: float,
        category: str,
    ) -> None:
        self._results.append(
            {
                "attack_id": attack_id,
                "template_id": template_id,
                "success": success,
                "score": score,
                "category": category,
            }
        )

    def get_collection_stats(self) -> dict[str, int]:
        chroma_count = self._collection.count() if self._collection is not None else 0
        return {
            "templates": len(self._templates),
            "chroma_templates": chroma_count,
            "results": len(self._results),
        }

    @property
    def chroma_enabled(self) -> bool:
        return self._collection is not None

    def needs_seed(self) -> bool:
        if self._collection is None:
            return len(self._templates) == 0
        return self._collection.count() == 0

    def search_templates(
        self,
        query: str,
        *,
        limit: int = 10,
        category: str | None = None,
    ) -> list[dict[str, object]]:
        """Semantic search over attack templates (Chroma when enabled, else in-memory cosine)."""
        query = query.strip()
        if not query:
            return []

        limit = max(1, min(limit, 50))

        if self._collection is not None and self._collection.count() > 0:
            try:
                kwargs: dict[str, object] = {
                    "query_texts": [query],
                    "n_results": min(limit, self._collection.count()),
                }
                if category:
                    kwargs["where"] = {"category": category}
                result = self._collection.query(**kwargs)
                ids = result.get("ids", [[]])[0]
                distances = result.get("distances", [[]])[0]
                metadatas = result.get("metadatas", [[]])[0]
                hits: list[dict[str, object]] = []
                for idx, template_id in enumerate(ids):
                    distance = distances[idx] if idx < len(distances) else 1.0
                    meta = metadatas[idx] if idx < len(metadatas) else {}
                    hits.append(
                        {
                            "id": template_id,
                            "score": round(max(0.0, 1.0 - float(distance)), 4),
                            "category": meta.get("category"),
                            "name": meta.get("name"),
                        }
                    )
                return hits
            except Exception as exc:
                logger.warning("Chroma attack search failed, using in-memory fallback: %s", exc)

        if not self._templates:
            return []

        from src.core.config import settings
        from src.data.embedding_manager import HighAccuracy1024EmbeddingFunction, cosine_similarity

        embedder = HighAccuracy1024EmbeddingFunction(model_name=settings.resolve_embedding_model())
        query_vec = embedder.embed(query)
        scored: list[dict[str, object]] = []

        for template in self._templates.values():
            cat = template.category.value if hasattr(template.category, "value") else str(template.category)
            if category and cat != category:
                continue
            doc = f"{template.name}\n{template.description}\n{template.template}"
            score = cosine_similarity(query_vec, embedder.embed(doc))
            scored.append(
                {
                    "id": template.id,
                    "score": round(score, 4),
                    "category": cat,
                    "name": template.name,
                }
            )

        scored.sort(key=lambda row: float(row["score"]), reverse=True)
        return scored[:limit]
