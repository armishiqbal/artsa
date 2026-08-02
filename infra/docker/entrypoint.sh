#!/bin/sh
# ARTSA API container entrypoint — migrations, optional RAG seed, then exec CMD.
set -e

cd /app/backend
export PYTHONPATH=/app/backend

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[entrypoint] Running Alembic migrations..."
  python -m alembic upgrade head || echo "[entrypoint] Alembic skipped (no revision or DB unavailable)"
fi

if [ "${SEED_RAG_ON_START:-false}" = "true" ] || [ "${USE_CHROMA_RAG:-false}" = "true" ] || [ "${USE_PINECONE_RAG:-false}" = "true" ]; then
  echo "[entrypoint] Seeding RAG policy knowledge..."
  python scripts/seed_rag_knowledge.py || echo "[entrypoint] RAG seed skipped"
fi

if [ "${SEED_ATTACK_LIBRARY_ON_START:-false}" = "true" ] || [ "${USE_CHROMA_RAG:-false}" = "true" ]; then
  echo "[entrypoint] Seeding attack library..."
  python scripts/seed_attack_library.py || echo "[entrypoint] Attack library seed skipped"
fi

echo "[entrypoint] Starting: $*"
exec "$@"
