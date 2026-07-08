"""Seed the attack library into ChromaDB for semantic search."""

import os
import sys

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.data.vector_store import VectorStoreManager
from src.data.attack_library import AttackLibrary

def main():
    print("Seeding ARTSA Attack Library to ChromaDB...")
    
    # Initialize ChromaDB
    vstore = VectorStoreManager(persist_dir="./data/chroma")
    
    # Initialize Library and load JSON files
    library = AttackLibrary(library_dir="./attack_library", vector_store=vstore)
    
    count = library.load_from_directory()
    
    print(f"Successfully loaded and embedded {count} attack templates.")
    stats = vstore.get_collection_stats()
    print(f"Vector Store Stats: {stats}")

if __name__ == "__main__":
    main()
