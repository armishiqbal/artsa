# Interactive Guardrail Detonation & Adversarial Probe Lab (`/playground`) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform ARTSA's `/playground` into an elite, real-time AI Security Firewall & Adversarial Detonation Lab benchmarked against Lakera Guard and Lakera Red, featuring dual-model detonation contrast, token-level threat heatmaps, enterprise jailbreak archetypes, and 1-click hotpatch promotion.

**Architecture:** Pure client-first progressive disclosure integrating with existing `/api/v1/playground/scan` and `/api/v1/playground/chat` endpoints. Provides real-time adversarial token analysis, side-by-side unmitigated vs. protected response comparison, and seamless transition to defense policy authoring.

**Tech Stack:** Next.js 14, React 18, Tailwind CSS, Lucide icons, Vitest.

---

## Global Constraints
- **Word Prohibition**: Must NOT use the prohibited keyword in user-facing UI text, component labels, or docs.
- **Context Integrity (`CONTEXT.md`)**: Distinguish clearly between live model queries and simulated target responses (labeled `"Simulated Target Response (Unmitigated)"`).
- **Aesthetics**: Pure white enterprise aesthetics (`bg-white`, slate borders, dark badges, monospace security tokens, zero neon).
- **Test Integrity**: All existing tests in `playgroundProjectEnforcement.test.ts` and `playgroundProviderSelection.test.ts` must continue to pass 100%.

---

## Tasks (Executed One-by-One)

### Task 1: Adversarial Jailbreak Preset Engine (`frontend/lib/playgroundAdversarialPresets.ts`)
- [x] **Step 1.1**: Create `frontend/lib/playgroundAdversarialPresets.ts` with 8 categorized threat vectors covering OWASP LLM01–05 / MITRE ATLAS, including token danger spans, unmitigated target failure responses, and protected refusal expectations.
- [x] **Step 1.2**: Write unit tests in `frontend/__tests__/lib/playgroundAdversarialPresets.test.ts` to verify catalog consistency, token span offsets, and categorization.
- [x] **Step 1.3**: Run `npm test -- playgroundAdversarialPresets.test.ts` to confirm test passes.
- [x] **Step 1.4**: Commit Task 1.

---

### Task 2: Token Threat Heatmap & Dual-Screen Detonation (`frontend/components/playground/AdversarialDetonationView.tsx`)
- [x] **Step 2.1**: Build `AdversarialDetonationView.tsx` component:
  - Token-level danger span highlighter (rendering highlighted spans with interactive risk tooltips).
  - Side-by-side execution comparison:
    - **Vanilla Target (Unmitigated)**: Shows the simulated data leak or system prompt breach that an unprotected model outputs.
    - **ARTSA Protected Shield**: Shows the real-time firewall intercept (`ALLOW`, `BLOCK`, `QUARANTINE`) with inspection latency in milliseconds.
- [x] **Step 2.2**: Integrate `AdversarialDetonationView` into `frontend/app/(app)/playground/page.tsx` for both Custom prompt and Example runs.
- [x] **Step 2.3**: Run `npm run typecheck` and `npm test` to verify.
- [x] **Step 2.4**: Commit Task 2.

---

### Task 3: 1-Click Policy Hotpatch Promotion (`frontend/components/playground/PromoteToPolicyModal.tsx`)
- [x] **Step 3.1**: Create or integrate hotpatch promotion modal / drawer enabling operators to convert any detected adversarial probe directly into an active defense policy rule.
- [x] **Step 3.2**: Add quick-action button in `GuardResultsTable` and `AdversarialDetonationView`.
- [x] **Step 3.3**: Verify and test.
- [x] **Step 3.4**: Commit Task 3.

---

### Task 4: End-to-End Verification & Verification Gates
- [x] **Step 4.1**: Run `npm run typecheck`.
- [x] **Step 4.2**: Run full Vitest suite (`npm test`).
- [x] **Step 4.3**: Curl `http://localhost:3000/playground` to verify HTTP 200 and clean rendering.
