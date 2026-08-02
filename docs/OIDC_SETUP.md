# OIDC / SSO Setup Guide

ARTSA supports two authentication methods:

1. **API keys** — `X-API-Key` header with role-scoped keys (`ARTSA_API_KEY`, `ARTSA_READONLY_API_KEY`, etc.)
2. **OIDC Bearer tokens** — `Authorization: Bearer <jwt>` validated against your IdP JWKS

Both can run together. The frontend can sign in via SSO (PKCE) and send the access token to the API.

---

## Backend configuration

```bash
ARTSA_OIDC_ENABLED=true
ARTSA_OIDC_ISSUER=https://login.microsoftonline.com/{tenant-id}/v2.0
ARTSA_OIDC_AUDIENCE={application-client-id}
ARTSA_OIDC_ROLE_CLAIM=groups
ARTSA_OIDC_ADMIN_GROUPS=artsa-admin
ARTSA_OIDC_ANALYST_GROUPS=artsa-analyst
ARTSA_OIDC_REDTEAM_GROUPS=artsa-redteam
ARTSA_OIDC_READONLY_GROUPS=artsa-readonly
# Optional fallback when user has no mapped group:
# ARTSA_OIDC_DEFAULT_ROLE=readonly
```

---

## Frontend configuration

```bash
NEXT_PUBLIC_OIDC_ENABLED=true
NEXT_PUBLIC_OIDC_ISSUER=https://login.microsoftonline.com/{tenant-id}/v2.0
NEXT_PUBLIC_OIDC_CLIENT_ID={application-client-id}
NEXT_PUBLIC_OIDC_SCOPE=openid profile email

# Server-only (Next.js API route — never expose in NEXT_PUBLIC_*)
OIDC_CLIENT_SECRET={client-secret}
```

Add redirect URI in your IdP:

```
http://localhost:3000/auth/callback
https://your-domain.com/auth/callback
```

---

## Azure AD (Entra ID)

1. **App registration** → New registration → Web redirect URI `/auth/callback`
2. **Certificates & secrets** → New client secret → set `OIDC_CLIENT_SECRET`
3. **Token configuration** → Add optional claim `groups` (or use app roles)
4. **App roles** (recommended):
   - `artsa-admin`, `artsa-analyst`, `artsa-redteam`, `artsa-readonly`
5. Assign users/groups to app roles in **Enterprise applications**
6. If using security groups instead of app roles, enable group claims in token configuration and map group Object IDs in `ARTSA_OIDC_*_GROUPS`

**Issuer:** `https://login.microsoftonline.com/{tenant-id}/v2.0`  
**Audience:** Application (client) ID

---

## Okta

1. **Applications** → Create App Integration → OIDC → Web
2. Sign-in redirect URI: `https://your-domain.com/auth/callback`
3. Assign **Groups** to the application
4. **Security** → API → Authorization servers → add custom claim `groups` to access token
5. Create Okta groups: `artsa-admin`, `artsa-analyst`, `artsa-redteam`, `artsa-readonly`
6. Configure backend group names to match Okta group names

**Issuer:** `https://{yourOktaDomain}/oauth2/default` (or custom auth server)  
**Audience:** Client ID from Okta app

---

## Role mapping

| IdP group / role   | ARTSA role | Capabilities                          |
|--------------------|------------|---------------------------------------|
| `artsa-admin`      | admin      | Full access                           |
| `artsa-analyst`    | analyst    | Read + ingest, forensics              |
| `artsa-redteam`    | redteam    | Read + campaigns + benchmarks         |
| `artsa-readonly`   | readonly   | GET endpoints only                    |

Verify with:

```bash
curl -H "Authorization: Bearer $ACCESS_TOKEN" http://localhost:8000/api/v1/config/me
```

---

## Docker startup

The API entrypoint runs Alembic migrations and seeds RAG knowledge when enabled:

```yaml
environment:
  USE_CHROMA_RAG: "true"
  SEED_RAG_ON_START: "true"
```

For Pinecone, set `USE_PINECONE_RAG=true` and ensure the index exists (1024 dimensions, cosine).
