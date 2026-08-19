"""Seed policy knowledge into the active RAG vector store (Pinecone or Chroma)."""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.agents.rag.store_factory import try_create_policy_store


def main() -> None:
    store = try_create_policy_store()
    if store is None:
        print("No vector store backend enabled (set USE_CHROMA_RAG or USE_PINECONE_RAG).")
        return

    if not hasattr(store, "seed_defaults"):
        print("Active store does not support seeding.")
        return

    count = store.seed_defaults()
    total = getattr(store, "count", count)
    print(f"Seeded {count} policy chunks. Store total: {total}")


if __name__ == "__main__":
    main()
