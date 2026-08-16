# Environment & API Key Setup

## Quick start

```bash
cp .env.example .env
npm run setup:env
npm run dev
curl http://localhost:8000/api/v1/config/keys
```

See `/providers` in the dashboard for a visual key status table.

## Security

- Never commit `.env`
- Never put API keys in `NEXT_PUBLIC_*` variables
- Backend-only: Pinecone, OpenAI, Lakera, Azure keys

## Signing in

The dashboard (`/login`) supports three ways to authenticate:

1. **Email + password** (default) — local accounts stored in the `users` table
   (`backend/data/artsa.db` on SQLite). The **first** registered account becomes
   the admin (bootstrap). Afterwards, new accounts can only be created with an
   admin API key (`X-API-Key`) via `POST /api/v1/auth/register`. Passwords are
   stored as salted PBKDF2-HMAC-SHA256 (600k iterations) — never plaintext.
   Sessions are short-lived HS256 JWTs signed with `SECRET_KEY`, sent as
   `Authorization: Bearer …`.
2. **API key** — a role key (`ARTSA_API_KEY` = admin, or the analyst/red-team/
   readonly keys) sent as `X-API-Key`.
3. **Organization SSO** — see [`OIDC_SETUP.md`](OIDC_SETUP.md).

## Authentication env vars

| Variable | Default | Purpose |
|----------|---------|---------|
| `ARTSA_PASSWORD_AUTH_ENABLED` | `true` | Turn local email/password login on/off. Requires a real `SECRET_KEY` (session signing). |
| `ARTSA_SESSION_TTL_SEC` | `28800` (8 h) | How long a password-login session token stays valid. |

## Key groups

| Group | Variables |
|-------|-----------|
| LLM | `OPENAI_API_KEY`, `GROQ_API_KEY`, `ANTHROPIC_API_KEY`, … |
| Guardrails | `LAKERA_API_KEY`, `AZURE_CONTENT_SAFETY_KEY` |
| Infra | `DATABASE_URL`, `PINECONE_API_KEY`, `SUPABASE_*` |
