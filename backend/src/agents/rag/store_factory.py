"""Factory for RAG policy vector stores — Pinecone > Chroma > in-memory."""

from __future__ import annotations

import logging
from typing import Any, Protocol

logger = logging.getLogger(__name__)


class PolicyVectorStore(Protocol):
    def query(self, query_text: str, top_k: int = 5) -> list[dict[str, Any]]: ...


def try_create_policy_store() -> PolicyVectorStore | None:
    """Return best available vector store backend."""
    from src.agents.rag.pinecone_store import try_create_pinecone_store

    store = try_create_pinecone_store()
    if store is not None:
        logger.info("RAG using Pinecone policy store")
        return store

    from src.agents.rag.chroma_store import try_create_chroma_store

    store = try_create_chroma_store()
    if store is not None:
        logger.info("RAG using Chroma policy store")
        return store

    return None
