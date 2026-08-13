"""Pinecone-backed policy knowledge store for managed vector RAG."""

from __future__ import annotations

import logging
from typing import Any

from src.agents.rag.knowledge_base import DEFAULT_KNOWLEDGE_CHUNKS
from src.core.config import settings
from src.data.embedding_manager import HighAccuracy1024EmbeddingFunction

logger = logging.getLogger(__name__)


class PineconePolicyStore:
    """Query/seed policy chunks in a Pinecone index."""

    def __init__(
        self,
        index_name: str | None = None,
        namespace: str | None = None,
        embedding_model: str | None = None,
    ) -> None:
        from pinecone import Pinecone

        api_key = settings.PINECONE_API_KEY
        if not api_key:
            raise RuntimeError("PINECONE_API_KEY not configured")

        self._index_name = index_name or settings.PINECONE_INDEX_NAME
        self._namespace = namespace or settings.PINECONE_NAMESPACE
        model = embedding_model or settings.resolve_embedding_model()
        self._embedder = HighAccuracy1024EmbeddingFunction(model_name=model)

        pc = Pinecone(api_key=api_key)
        self._index = pc.Index(self._index_name)

    @property
    def count(self) -> int:
        stats = self._index.describe_index_stats()
        namespaces = stats.get("namespaces") or {}
        if self._namespace in namespaces:
            return int(namespaces[self._namespace].get("vector_count", 0))
        return int(stats.get("total_vector_count", 0))

    def seed_defaults(self) -> int:
        if not DEFAULT_KNOWLEDGE_CHUNKS:
            return 0

        vectors = []
        for chunk in DEFAULT_KNOWLEDGE_CHUNKS:
            vectors.append(
                {
                    "id": chunk["id"],
                    "values": self._embedder.embed(chunk["text"]),
                    "metadata": {
                        "text": chunk["text"],
                        "source": chunk["source"],
                    },
                }
            )

        self._index.upsert(vectors=vectors, namespace=self._namespace)
        return len(vectors)

    def query(self, query_text: str, top_k: int = 5) -> list[dict[str, Any]]:
        if not query_text.strip():
            return []

        query_vec = self._embedder.embed(query_text)
        result = self._index.query(
            vector=query_vec,
            top_k=top_k,
            namespace=self._namespace,
            include_metadata=True,
        )

        chunks: list[dict[str, Any]] = []
        for match in result.get("matches", []):
            meta = match.get("metadata") or {}
            chunks.append(
                {
                    "id": match.get("id", ""),
                    "text": meta.get("text", ""),
                    "source": meta.get("source", "unknown"),
                    "score": round(float(match.get("score", 0.0)), 4),
                }
            )
        return chunks


def try_create_pinecone_store() -> PineconePolicyStore | None:
    if settings.is_testing or not settings.USE_PINECONE_RAG:
        return None
    if not settings.is_key_configured("PINECONE_API_KEY"):
        return None
    try:
        store = PineconePolicyStore()
        if store.count == 0:
            store.seed_defaults()
        return store
    except Exception as exc:
        logger.warning("Pinecone RAG unavailable, falling back: %s", exc)
        return None
