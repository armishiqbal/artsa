# Deploy ARTSA on Vercel

## What deploys on Vercel (and what doesn't)

| Piece | On Vercel? | Notes |
|---|---|---|
| **Next.js dashboard** (`frontend/`) | ✅ Yes — first-class | Builds with `output: "standalone"`, all routes static/SSR fine |
| **FastAPI backend** | ⚠️ Experimental only | Serverless functions can't run WebSockets, Celery workers, or a persistent filesystem — the live dashboard feed, campaign workers, SQLite, and Chroma RAG **will not work** there |
| **Database / Redis / vector store** | ❌ External only | Vercel has an ephemeral read-only filesystem; use Neon/Supabase (Postgres), Upstash (Redis), MongoDB Atlas |

**Recommended architecture:** dashboard on **Vercel** + backend on a container host (Railway / Render / Fly / your `docker-compose` or Helm), with the dashboard pointed at it via env vars. This is a one-command Vercel deploy and keeps every feature working.

---

## 1. Deploy the dashboard (recommended path)

The repo already has `vercel.json` (root `frontend/`, Next.js). Steps:

```bash
# 1. Login (opens a browser)
vercel login

# 2. From the repo root
vercel link          # create/link the project
```

### Required environment variables (Vercel project → Settings → Environment Variables)

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://your-backend.example.com` (the hosted FastAPI base URL, **no trailing slash, no /api/v1**) |
| `NEXT_PUBLIC_WS_URL` | `wss://your-backend.example.com/api/v1/websocket` |
| `BACKEND_URL` | same as `NEXT_PUBLIC_API_URL` (used by the server-side `/api/backend/*` proxy) |
| `ARTSA_API_KEY` | the backend admin key, if auth is enabled (server-side only — never `NEXT_PUBLIC_`) |
| `NEXT_PUBLIC_OIDC_ENABLED` | `false` unless you have an OIDC provider |

> The frontend sends REST via `/api/backend/*` (rewritten by `next.config.js` to `BACKEND_URL`) and the WebSocket connects to `NEXT_PUBLIC_WS_URL`. All data stays tenant-scoped through the `X-Tenant-ID` header the UI sends automatically.

```bash
# 3. Deploy
vercel --prod
```

## 2. Backend on a container host (keeps everything working)

```bash
# Render / Railway / Fly — one service from the repo root:
#   build:  docker build -f infra/docker/api.Dockerfile .
#   env:    DATABASE_URL (Postgres), REDIS_URL, ARTSA_API_KEY, USE_SQLITE=false
# then set NEXT_PUBLIC_API_URL / NEXT_PUBLIC_WS_URL / BACKEND_URL above to it.
```

## 3. Experimental: backend as Vercel Python functions

Not recommended for production — the backend imports langchain/chromadb/celery at
startup (huge install, slow cold starts) and WebSockets + Celery + filesystem
persistence don't exist on serverless. If you still want to try:

1. Move the FastAPI app behind an ASGI adapter in `api/index.py`
   (`from vercel_python.asgi import create_asgi_app; handler = create_asgi_app(app)`).
2. Provide a root `requirements.txt` including the full backend dependency set.
3. Accept: no live WS feed, no campaign workers, external Postgres/Redis/Mongo
   required, slow cold starts, 250 MB function-size ceiling (langchain+chromadb
   already near it).

## Verification checklist after deploy

- `https://<your-app>.vercel.app` loads the login page → dashboard
- Alerts panel shows the backend's live state (WS connected) when a backend is reachable
- `GET /api/backend/health` returns the backend health envelope (proves the BFF proxy + env wiring)
