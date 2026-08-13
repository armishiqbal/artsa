# 🤝 AGENT CONTRACT — v0.4 Parallel Rollout

> **Read this first. This file is the single source of truth for the 6-agent
> parallel rollout.** It locks the route map, the design tokens, per-agent file
> ownership, merge order, and verification gates. Violations cause merge hell.

**Status:** LOCKED — foundation files committed. Agents build on top of them.

---

## 1. 🔗 LOCKED ROUTE MAP (v0.4 — RECONCILED with agent builds)

> **UPDATE:** Agents implemented their own scheme before this contract landed.
> This table now reflects **what is actually on disk and canonical**.
> Legacy URLs are 308/301-redirected in `frontend/next.config.js` (agent version).

| Function | Canonical URL | On disk | Legacy redirect |
|----------|--------------|---------|-----------------|
| Command Center | `/dashboard` | ✅ `app/dashboard/` | `/` |
| Topology | `/dashboard/topology` | ✅ `app/dashboard/topology/` | `/topology` |
| Wargame | `/campaigns` | ✅ `app/campaigns/` | `/wargame` |
| Attack Sandbox | `/sandbox` | ✅ `app/sandbox/` | `/playground` |
| Attack Library | `/library` | ✅ `app/library/` (enhanced: import/export/versioning) | `/attack-library` |
| Replay | `/replay` | ✅ | — |
| Agentic Risks | `/risks` | ✅ (kept — no rename) | — |
| Reports | `/reports` | ✅ (kept — no rename) | — |
| Get Started | `/get-started` | ✅ (kept — no rename) | — |
| Settings hub | `/settings` | ✅ `app/settings/` | — |
| Integrations & Keys | `/settings/integrations` | ✅ | `/providers` → `/admin/providers` |
| Audit Log | `/settings/audit-log` | ✅ | — |
| Notifications | `/settings/notifications` | ✅ | — |
| Team | `/settings/team` | ✅ | — |
| Admin Overview | `/admin` | ✅ | — |
| Admin Providers | `/admin/providers` | ✅ | `/providers` |
| Policies | `/admin/policies` | ✅ `app/admin/policies/` | `/policies` |
| Alerts & Integrations | `/admin/alerts` | ✅ | — |
| System & Keys | `/admin/system` | ✅ | — |
| Design System | `/design-system` | ✅ NEW (A1) | — |
| Login / Auth callback | `/login`, `/auth/callback` | ✅ | — |

### 🧹 Dedupe backlog (delete after branches merge — verified by integration lead)

| Dead duplicate | Reason |
|----------------|--------|
| `app/page.tsx` (root) | Superseded by `app/dashboard/`; `/` now redirects |
| `app/wargame/` | Superseded by `app/campaigns/` |
| `app/playground/` | Superseded by `app/sandbox/` |
| `app/attack-library/` | Superseded by `app/library/` |
| `app/topology/` | Superseded by `app/dashboard/topology/` |
| `app/policies/` | Superseded by `app/admin/policies/` |
| `app/providers/` | Superseded by `app/settings/integrations/` |

### ⚠️ Known nits (fix in routing agent's final pass)

1. ~~`lib/navigation.ts` still points `Policies → /policies`~~ ✅ **RESOLVED** — now `/admin/policies` directly.
2. ~~`Get Started / Onboarding` rename~~ ✅ **NOT adopted** — `/get-started` stays canonical (by agent decision).
3. **A6 — response envelope migration:** ✅ **COMPLETE.** `ResponseEnvelopeMiddleware` is enabled by default (`ARTSA_RESPONSE_ENVELOPE=true`). All consumers migrated: `frontend/lib/api.ts` unwrap, Python SDK sync + async unwrap, TypeScript SDK unwrap, affected API tests unwrap. Documented in `docs/ADR-002-api-response-envelope.md` and `.env.example`.

---

## 2. 🎨 LOCKED DESIGN TOKENS — "Cyber Ember"

**Theme:** Deep navy-black surfaces + warm amber primary. Ops-room feel.
All tokens live in `frontend/app/globals.css`. **Components must ONLY reference
Tailwind semantic classes (`bg-primary`, `text-muted-foreground`, …) or tokens —
NEVER hardcode hex colors.**

### Core palette (HSL)

| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `222 24% 4.5%` | App background (near-black navy) |
| `--foreground` | `30 18% 96%` | Primary text (warm white) |
| `--card` | `222 22% 6.5%` | Card surfaces |
| `--primary` | `27 95% 53%` | **Brand amber** — buttons, active nav, links |
| `--primary-foreground` | `25 45% 8%` | Text on amber (dark brown-black) |
| `--muted` | `222 12% 13%` | Subtle fills, code blocks |
| `--muted-foreground` | `222 10% 58%` | Secondary text |
| `--border` | `222 12% 15%` | Hairlines |
| `--destructive` | `0 78% 56%` | Delete / block actions |
| `--ring` | `27 95% 53%` | Focus rings (brand amber) |
| `--radius` | `0.75rem` | Border radius (slightly rounder) |

### Severity scale

| Token | Value |
|-------|-------|
| `--severity-critical` | `0 78% 56%` |
| `--severity-high` | `15 90% 55%` |
| `--severity-medium` | `38 92% 50%` |
| `--severity-low` | `142 65% 45%` |

### Charts

`--chart-1` amber `27 95% 53%` · `--chart-2` teal `170 72% 42%` ·
`--chart-3` violet `262 68% 64%` · `--chart-4` red `0 78% 56%` ·
`--chart-5` gold `45 92% 50%`

### New utility classes (already in globals.css)

- `.brand-gradient` — signature amber gradient (logo accents, hero banners, active states)
- `.ember-glow` — subtle amber glow for critical widgets

### Branding rules for ALL agents

1. **Logo:** Replace the generic `<Shield>` icon in `Sidebar.tsx`, `TopNav.tsx`,
   `login/page.tsx` with the new brand logo component (`components/BrandLogo.tsx`,
   owned by A1) once delivered. Do not invent your own logo.
2. **Favicon:** `frontend/app/icon.svg` is owned by A1. Currently missing.
3. **Typography:** Keep Inter + JetBrains Mono (font vars already wired in layout).

---

## 3. 📦 FILE OWNERSHIP MATRIX

**Rule: You own your rows. Do NOT edit files owned by another agent.**

| Agent | Owns (create/move/edit) | Must NOT touch |
|-------|------------------------|----------------|
| **A1 Branding** | `frontend/components/BrandLogo.tsx` (new), `frontend/app/icon.svg` (new), `frontend/components/layout/Sidebar.tsx` (logo + visual only), `frontend/components/layout/TopNav.tsx` (logo only), `frontend/app/login/page.tsx` (logo only), any new `components/shared/Brand*` | `lib/navigation.ts`, `next.config.js`, page routes, `globals.css` tokens (read-only) |
| **A2 Routing** | `app/dashboard/page.tsx` (git mv from `app/page.tsx`), `app/onboarding/` (git mv from `app/get-started/`), `app/sandbox/` (git mv from `app/playground/`), `app/threats/` (git mv from `app/risks/`), `app/compliance/` (git mv from `app/reports/`), `app/settings/integrations/` (git mv from `app/providers/`), `app/admin/policies/` (git mv from `app/policies/`), all `<Link>`/`router.push` reference sweeps in `components/` + `lib/` + `app/` | Content/visual redesign of those pages (that's A3/A4/A5) |
| **A3 Dashboard** | `app/dashboard/page.tsx` content, `components/shared/StatCard.tsx`, `components/shared/DashboardCard.tsx`, `components/shared/ThreatMatrix.tsx`, `components/shared/ThreatRow.tsx`, `components/XRayPanel.tsx`, `components/ObservatoryPanel.tsx`, `components/charts/*` | Routing, navigation, other pages |
| **A4 Sandbox/Wargame/Attack Lib** | `app/sandbox/`, `app/wargame/`, `app/attack-library/`, `app/replay/` content, related hooks (`useCampaignRun`, etc.) | Routing, dashboard, admin |
| **A5 Settings/Admin** | `app/settings/integrations/`, `app/admin/`, `app/login/`, `components/Auth*`, `components/layout/AlertsInbox.tsx`, tenant selector work | Sandbox/wargame/dashboard pages |
| **A6 Backend/SDK/DevOps** | `backend/**`, `sdk/**`, `infra/**`, `.github/**`, `scripts/**`, docs | `frontend/**` entirely |

**Shared but coordinated:** `frontend/components/ui/*` (button, badge, card, input,
tabs, progress, etc.) — if you must change one, coordinate with the other agents
first, or keep changes additive (new prop, optional).

---

## 4. 🔀 MERGE ORDER & BRANCHES

```bash
git checkout -b agent1-branding
git checkout -b agent2-routing
git checkout -b agent3-dashboard
git checkout -b agent4-sandbox
git checkout -b agent5-settings
git checkout -b agent6-backend
```

**Merge into `main` in this exact order:**

```
A6 (backend — independent, merge first or last, no conflicts)
  → A1 (branding foundation)
  → A2 (routing — every other frontend agent depends on it)
  → A3 (dashboard)
  → A4 (sandbox/wargame/library)
  → A5 (settings/admin — last, resolves any leftover link references)
```

**Critical dependency:** A2 MUST be merged before A3/A4/A5 branches are reviewed,
because A3/A4/A5 build pages at the NEW URLs. If an agent cannot wait, they
branch off `agent2-routing` after A2 is stable.

---

## 5. ✅ VERIFICATION GATES (required before merge)

```bash
# Frontend agents (A1–A5) — run in frontend/
npx tsc --noEmit          # zero type errors
npm run lint              # zero lint errors
npm run build             # production build succeeds

# Backend agent (A6) — run in backend/
PYTHONPATH=. python -m pytest tests -x -q    # all tests pass
ruff check src tests                          # lint clean

# After ALL merges — integration (done by integration lead):
npm run test:e2e          # Playwright suite green
npm run regression-gate   # CI regression floors
```

---

## 6. 🚫 HARD RULES

1. **Never hardcode hex colors** — use tokens (`bg-primary`, `text-muted-foreground`).
2. **Never create a page at an old URL** — use the route map table.
3. **Never edit a file you don't own** (see matrix). If you need a change there,
   note it in your PR description instead.
4. **Never rename a route without updating** `lib/navigation.ts` + `next.config.js`
   redirects + this document.
5. **Keep `frontend/lib/api.ts`, `frontend/lib/connectionStatus.ts`,
   `frontend/lib/utils.ts` untouched** — shared infrastructure (only A6 can
   change lib/ behavior, and only API-related).
6. **No secrets in UI code.** Keys are server-side only.

---

## 7. 📋 QUICK TASK ASSIGNMENT

| # | Agent | Deliverables |
|---|-------|--------------|
| 1 | Branding | Logo component + favicon, Sidebar/TopNav/Login visual rebrand, brand utilities |
| 2 | Routing | Move 7 page dirs per route map, sweep all link references, verify 308s |
| 3 | Dashboard | Command Center redesign (hero banner, sparklines, telemetry filter), shared card polish |
| 4 | Sandbox/Wargame/Attack Lib | Redesign sandbox composer + results, model comparison, attack chain viz |
| 5 | Settings/Admin | Integrations & Keys page, tenant selector, audit log viewer, notification prefs |
| 6 | Backend/SDK/DevOps | Canary/output detectors, API response standardization, TS SDK tests, k6 load scripts |

**Questions about the contract → ask the integration lead (main branch).**
