# Security Response: Exposed API Keys

> **Status:** Resolved (mitigation) — key rotation still required.

## Summary

Real production credentials were found in environment backup files at the repository root:

- `.env.bak`
- `.env.env.bak`

These files contain provider API keys (e.g. OpenAI, Pinecone, Supabase). They were **never tracked by git** (confirmed via `git status`), but they were also **not covered by `.gitignore`**, meaning any `git add .` / `git commit -a` could have committed them.

## What was done

- Added `.gitignore` rules so no `.env.*` variant can ever be committed:
  ```gitignore
  *.env.*
  !*.env.example
  !*.env.local.example
  ```
- Added a fail-fast guard in `backend/src/core/config.py` that aborts startup in production if `SECRET_KEY` is still the default `change-me-in-production`.
- Fixed a bug in `frontend/lib/stores/auth.ts` where `setBearerToken` wrote `refreshToken: undefined` (would corrupt persisted auth state).

## Required: Rotate all affected keys

Exposure to the filesystem does **not** prove exfiltration, but keys written in plaintext backups should be treated as compromised. Rotate them:

### 1. OpenAI (sk-proj-...)
1. Go to https://platform.openai.com/api-keys
2. Revoke the affected key(s)
3. Create a new key with the same scopes
4. Update `OPENAI_API_KEY` in `.env`

### 2. Pinecone (pcsk_...)
1. Go to https://app.pinecone.io → API Keys
2. Delete/rotate the affected key
3. Update `PINECONE_API_KEY` / `PINECONE_ENVIRONMENT` in `.env`

### 3. Supabase
1. Go to Project → Settings → API
2. Rotate the `service_role` key (and `anon`/`publishable` if present in the backups)
3. Update `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_URL` in `.env`

### 4. JWT/`SECRET_KEY`
1. If the value in the backups is used as `SECRET_KEY` or JWT signing secret, generate a new one:
   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(64))"
   ```
2. Update `.env` and restart.

## After rotation

1. Delete the backup files (or store them in a password manager / offline vault):
   ```bash
   rm .env.bak .env.env.bak
   ```
2. Verify nothing leaks into git:
   ```bash
   git status
   git ls-files | grep -i env
   ```
3. Confirm the backend starts in production-like mode:
   ```bash
   cd backend && .venv/bin/python -c "from src.core.config import Settings; Settings()"
   ```
   (This raises if `SECRET_KEY` is still the default.)
4. Restart all services so they pick up the rotated keys.

## Prevention

- Never create `.env.bak`/`.env.copy` style files in the repo — use your password manager or `~/.config/artsa/`.
- The `.gitignore` rules added here cover `*.env.*`, so future variants are ignored by default.
- Consider adding a pre-commit hook that blocks commits containing known key patterns:
  ```bash
  # .git/hooks/pre-commit
  if git grep -nE "sk-(proj|ant)-|pcsk_|AKIA[0-9A-Z]{16}" --cached -- ':!*.md' > /dev/null; then
    echo "Potential secret detected. Aborting commit."
    exit 1
  fi
  ```
