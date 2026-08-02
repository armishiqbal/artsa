"""Seed attack library templates into vector store (Chroma when enabled)."""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.core.config import settings  # noqa: E402
from src.data.attack_library import AttackLibrary  # noqa: E402
from src.data.vector_store import VectorStoreManager  # noqa: E402


def main() -> None:
    library_dir = settings.ARTSA_DATA_DIR.rstrip("/") + "/../attack_library"
    backend_lib = os.path.join(os.path.dirname(__file__), "..", "attack_library")
    lib_path = backend_lib if os.path.isdir(backend_lib) else library_dir

    persist_dir = settings.CHROMA_PERSIST_DIR
    print(f"Seeding attack library from {lib_path} → {persist_dir}")

    vstore = VectorStoreManager(persist_dir=persist_dir)
    if not vstore.needs_seed() and vstore.chroma_enabled:
        stats = vstore.get_collection_stats()
        print(f"Attack library already seeded ({stats['chroma_templates']} templates in Chroma).")
        return

    library = AttackLibrary(library_dir=lib_path, vector_store=vstore)
    count = library.load_from_directory()
    stats = vstore.get_collection_stats()
    print(f"Loaded {count} attack templates. Stats: {stats}")


if __name__ == "__main__":
    main()
