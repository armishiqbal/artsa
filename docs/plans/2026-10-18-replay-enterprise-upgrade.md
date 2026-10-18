# Forensic Session Replay & Cryptographic Audit Workbench (`/replay`) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform ARTSA's `/replay` into an elite Forensic Session Replay & Cryptographic Audit Workbench benchmarked against enterprise incident forensics, complete with pre-flight multi-hop incident walkthroughs (zero-state resilience), HMAC custody chain verification, visual tool blast radius navigation, and strict compliance with `CONTEXT.md`.

**Architecture:** Client-first dataset mode toggle (`Live Operations` vs `Incident Walkthrough`) integrating with existing `/api/v1/sessions` and `/api/v1/sessions/{id}/timeline` endpoints. Provides full forensic fidelity on live sessions, with rich multi-hop demonstration data when operational storage is empty.

**Tech Stack:** Next.js 14, React 18, Tailwind CSS, Lucide icons, Vitest.

---

## Global Constraints
- **Word Prohibition**: Must NOT use the prohibited keyword in user-facing UI text, component labels, or docs.
- **Context Integrity (`CONTEXT.md`)**: Strictly label non-live demonstration sessions as `"Pre-Flight Incident Walkthrough · Labeled Demonstration Suite"`. Never describe seeded work as live telemetry.
- **Aesthetics**: Pure white enterprise aesthetics (`bg-white`, slate borders, dark badges, monospace security tokens, zero neon).
- **Test Integrity**: All existing tests in `replayTheater.test.tsx` and related suites must continue to pass 100%.

---

## Tasks (Executed One-by-One)

### Task 1: Replay Walkthrough Dataset & Zero-State Engine (`frontend/lib/replayDemoData.ts`)
- [x] **Step 1.1**: Create `frontend/lib/replayDemoData.ts` exporting canonical pre-flight demonstration sessions and rich multi-hop timelines (covering `sess-cyberstorm-01`, `sess-finance-pivot-02`, and `sess-rag-sanitize-03`), with complete HMAC custody metadata and evaluations.
- [x] **Step 1.2**: Write unit tests in `frontend/__tests__/lib/replayDemoData.test.ts` verifying session metadata, timeline hop continuity, and breach verdicts.
- [x] **Step 1.3**: Run `npm test -- replayDemoData.test.ts` to confirm test passes.
- [x] **Step 1.4**: Commit Task 1.

---

### Task 2: Replay Content Dataset Mode & Walkthrough Banner (`frontend/app/(app)/replay/ReplayContent.tsx`)
- [x] **Step 2.1**: Update `ReplayContent.tsx`:
  - Add `datasetMode: "demo" | "live"` state with intelligent fallback when `liveSessions.length === 0`.
  - Add a pre-flight walkthrough guidance banner with clear dataset toggle (`Incident Walkthrough (3)` vs `Live Operations (N)`).
  - Clean up any legacy or prohibited keywords in code comments and labels.
- [x] **Step 2.2**: Integrate HMAC chain-of-custody verification badge and tool blast radius indicators into the timeline.
- [x] **Step 2.3**: Run `npm run typecheck` and `npm test -- replayTheater.test.tsx` to verify.
- [x] **Step 2.4**: Commit Task 2.

---

### Task 3: Full Verification & Verification Gates
- [x] **Step 3.1**: Run `npm run typecheck`.
- [x] **Step 3.2**: Run full Vitest suite (`npm test`).
- [x] **Step 3.3**: Run risk framework and documentation sync scripts.
- [x] **Step 3.4**: Curl `http://localhost:3000/replay` to verify HTTP 200 and clean rendering.
