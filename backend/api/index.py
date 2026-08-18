"""Vercel serverless entrypoint for the ARTSA FastAPI backend.

Vercel Python functions run on AWS Lambda under the hood, so Mangum is the
standard ASGI adapter. Only what the app imports at startup is required (see
requirements-vercel.txt — chromadb/celery/onnxruntime are lazily imported and
excluded to stay under the function size limit).

Known serverless limits (see docs/DEPLOY_VERCEL.md):
  * no persistent WebSocket live feed,
  * long-running campaign workers are best-effort only,
  * filesystem (SQLite/Chroma/results) is ephemeral — use external Postgres/Redis.
"""

from mangum import Mangum

from src.api.main import app

handler = Mangum(app, lifespan="off")
