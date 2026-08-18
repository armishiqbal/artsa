# Deploy ARTSA on Vercel (full stack, no self-hosted server)

Verified: the dashboard builds on Vercel AND the FastAPI backend runs as a
Vercel Python function (Mangum adapter, tested locally through a Lambda-style
invocation: `GET /api/v1/health` → 200).

## Architecture (two Vercel projects, same repo)

```
Vercel Project A  "artsa-dashboard"  (rootDirectory: frontend)   → Next.js UI
Vercel Project B  "artsa-api"        (rootDirectory: backend)    → FastAPI function (api/index.py)
                        │
                        └─ external free services (zero-ops, not self-hosted):
                           Postgres → Neon (free tier)  ·  Redis → Upstash (free, optional)
```

## What is NOT available on serverless (be honest with yourself)

| Feature | On serverless | Impact |
|---|---|---|
| Dashboard UI | ✅ Full | — |
| REST API, ingest, detection, scoring, policies, alerts, integrations | ✅ Full | verified 200 on health |
| **WebSocket live feed** | ❌ | dashboard shows degraded/offline connection |
| **Long campaign workers** (`USE_CELERY=false` inline) | ⚠️ best-effort | multi-round campaigns may be cut off |
| SQLite / Chroma / `data/results` filesystem | ❌ ephemeral | use external Postgres; RAG falls back to in-memory; on-disk results not persisted |
| Cold starts | ⚠️ slow (langchain import) | expect ~10-30s first hit |

## Deploy steps

### 1. Frontend project (`artsa-dashboard`)

```bash
vercel login
vercel link --project artsa-dashboard     # from repo root; vercel.json sets rootDirectory: frontend
vercel env add NEXT_PUBLIC_API_URL        # = https://artsa-api.vercel.app   (the API project URL)
vercel env add NEXT_PUBLIC_WS_URL         # = wss://artsa-api.vercel.app/api/v1/websocket (won't work serverless — optional)
vercel env add BACKEND_URL                # = https://artsa-api.vercel.app
vercel --prod
```

### 2. Backend project (`artsa-api`)

```bash
# from repo root, but the project is rooted at backend/ (backend/vercel.json)
vercel link --project artsa-api
vercel env add ENVIRONMENT               # production
vercel env add ARTSA_CORS_ORIGINS        # ["https://artsa-dashboard.vercel.app"]
vercel env add USE_SQLITE                # false
vercel env add DATABASE_URL              # postgresql+asyncpg://user:pass@<neon-host>/artsa?sslmode=require
vercel env add SYNC_DATABASE_URL         # postgresql://user:pass@<neon-host>/artsa?sslmode=require (sync URL for alembic)
vercel env add ARTSA_API_KEY             # a long random key (auth)
vercel env add USE_CELERY                # false
vercel env add USE_CHROMA_RAG            # false
vercel env add USE_PINECONE_RAG          # false
vercel --prod
```

`backend/api/index.py` (Mangum adapter) + `backend/requirements-vercel.txt`
(slimmed — excludes chromadb/celery/onnxruntime so the function stays under the
size ceiling) are already in the repo.

### 3. Create the Postgres schema (one-time, from anywhere)

```bash
cd backend && USE_SQLITE=false SYNC_DATABASE_URL="postgresql://...neon..." alembic upgrade head
```

## Verification

- `https://artsa-api.vercel.app/api/v1/health` → `{"status":"ok",...}`
- `https://artsa-dashboard.vercel.app` loads, ingest + detection work, alerts list
- Expect the live WebSocket indicator to show degraded (serverless limitation)

## Alternative (everything works)

Dashboard on Vercel + backend on a container host (Railway/Render/Fly, one
`docker build -f infra/docker/api.Dockerfile .`) — the only way to keep the
live WS feed, campaign workers, and on-disk results.
