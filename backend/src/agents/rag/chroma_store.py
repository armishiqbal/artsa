"""ChromaDB-backed policy knowledge store for RAG retrieval."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, List

from src.agents.rag.knowledge_base import DEFAULT_KNOWLEDGE_CHUNKS
from src.core.config import settings
from src.data.embedding_manager import HighAccuracy1024EmbeddingFunction

logger = logging.getLogger(__name__)

COLLECTION_NAME = "artsa_policy_kb"


class ChromaPolicyStore:
    """Persistent Chroma collection for security policy chunks."""

    def __init__(self, persist_dir: str | None = None, embedding_model: str | None = None) -> None:
        import chromadb

        self._persist_dir = Path(persist_dir or settings.CHROMA_PERSIST_DIR)
        self._persist_dir.mkdir(parents=True, exist_ok=True)
        model = embedding_model or settings.resolve_embedding_model()
        self._embedder = HighAccuracy1024EmbeddingFunction(model_name=model)
        self._client = chromadb.PersistentClient(path=str(self._persist_dir))
        self._collection = self._client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )

    @property
    def count(self) -> int:
        return self._collection.count()

    def seed_defaults(self) -> int:
        """Upsert default knowledge chunks; returns number seeded."""
        if not DEFAULT_KNOWLEDGE_CHUNKS:
            return 0

        ids = [c["id"] for c in DEFAULT_KNOWLEDGE_CHUNKS]
        documents = [c["text"] for c in DEFAULT_KNOWLEDGE_CHUNKS]
        metadatas = [{"source": c["source"]} for c in DEFAULT_KNOWLEDGE_CHUNKS]
        embeddings = [self._embedder.embed(text) for text in documents]

        self._collection.upsert(
            ids=ids,
            documents=documents,
            metadatas=metadatas,
            embeddings=embeddings,
        )
        return len(ids)

    def query(self, query_text: str, top_k: int = 5) -> List[Dict[str, Any]]:
        if not query_text.strip():
            return []

        query_vec = self._embedder.embed(query_text)
        result = self._collection.query(
            query_embeddings=[query_vec],
            n_results=min(top_k, max(1, self._collection.count())),
            include=["documents", "metadatas", "distances"],
        )

        chunks: List[Dict[str, Any]] = []
        ids = result.get("ids", [[]])[0]
        docs = result.get("documents", [[]])[0]
        metas = result.get("metadatas", [[]])[0]
        dists = result.get("distances", [[]])[0]

        for chunk_id, doc, meta, dist in zip(ids, docs, metas, dists):
            # Chroma cosine distance: lower is better; convert to similarity score
            score = round(max(0.0, 1.0 - float(dist)), 4)
            chunks.append(
                {
                    "id": chunk_id,
                    "text": doc,
                    "source": (meta or {}).get("source", "unknown"),
                    "score": score,
                }
            )

        return chunks


def try_create_chroma_store() -> ChromaPolicyStore | None:
    """Create Chroma store when enabled; return None on failure."""
    if settings.is_testing or not settings.USE_CHROMA_RAG:
        return None
    try:
        store = ChromaPolicyStore()
        if store.count == 0:
            store.seed_defaults()
        return store
    except Exception as exc:
        logger.warning("Chroma RAG unavailable, using in-memory fallback: %s", exc)
        return None
