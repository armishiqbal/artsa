# Red Team Operations & Multi-Agent Campaign War Room (`/red-team`) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform ARTSA's `/red-team` and `/red-team/campaigns` into an elite Multi-Agent Campaign War Room benchmarked against enterprise AI security standards and CrewAI multi-agent orchestration principles, featuring the canonical Six-Agent Chain (`Research`, `Curator`, `Red Team`, `Target`, `Judge`, `Defender`), HMAC cryptographic handoffs, labeled pre-flight adversarial simulations, and zero-state resilience.

**Architecture:** Client-first dataset toggle (`Simulation Suite` vs `Live Telemetry`) integrating with existing `/api/v1/campaigns` and WebSocket/SSE event streams. Provides interactive CrewAI role-based agent visualization (Role, Goal, Backstory, Tools, HMAC signatures, Context Passing) and rich multi-agent telemetry when operational storage has zero campaigns.

**Tech Stack:** Next.js 14, React 18, Tailwind CSS, Lucide icons, Vitest.

---

## Global Constraints
- **Word Prohibition**: Must NOT use the prohibited keyword in user-facing UI text, component labels, or docs.
- **Context Integrity (`CONTEXT.md`)**: Strictly label non-live demonstration campaigns as `"Pre-Flight Multi-Agent Simulation · Labeled Demonstration Suite"`. Never describe seeded work as live telemetry. Follow the canonical Six-Agent Chain contract (`ADR-008`).
- **Aesthetics**: Pure white enterprise aesthetics (`bg-white`, slate borders, dark badges, monospace security tokens, zero neon).
- **Test Integrity**: All existing tests across all suites must continue to pass 100%.

---

## Tasks (Executed One-by-One)

### Task 1: Pre-Flight Multi-Agent Campaign Dataset & Six-Agent Topology (`frontend/lib/redTeamDemoData.ts`)
- [x] **Step 1.1**: Create `frontend/lib/redTeamDemoData.ts` exporting:
  - Canonical 6 CrewAI-style agent definitions (`CREW_SIX_AGENTS`: Research, Curator, Red Team, Target, Judge, Defender) with roles, goals, tools, and execution handoffs.
  - 3 pre-flight multi-agent demonstration campaigns (`DEMO_REDTEAM_CAMPAIGNS`: ASI01 prompt extraction, ASI02 tool SSRF breakout, ASI04 RAG poisoning).
  - Round-by-round event streams (`DEMO_CAMPAIGN_EVENTS`) showing realistic multi-agent execution and HMAC handoffs.
- [x] **Step 1.2**: Write unit tests in `frontend/__tests__/lib/redTeamDemoData.test.ts` verifying agent topology, campaign metadata, and round event sequence continuity.
- [x] **Step 1.3**: Run `npm test -- redTeamDemoData.test.ts` to confirm test passes.
- [x] **Step 1.4**: Commit Task 1.

---

### Task 2: CrewAI Six-Agent Orchestration Visualizer Component (`frontend/components/red-team/CrewAgentChainViz.tsx`)
- [x] **Step 2.1**: Build `frontend/components/red-team/CrewAgentChainViz.tsx`:
  - Visualizes the 6-agent chain with active execution pulse, HMAC custody badges, and tool badges.
  - Allows clicking any agent in the crew to inspect its Role, Operational Goal, Toolset, and Output Context passed to the next agent.
- [x] **Step 2.2**: Write unit tests in `frontend/__tests__/components/crewAgentChainViz.test.tsx`.
- [x] **Step 2.3**: Run `npm test -- crewAgentChainViz.test.tsx` to verify.
- [x] **Step 2.4**: Commit Task 2.

---

### Task 3: Red Team Hub & Campaigns Integration (`frontend/app/(app)/red-team/page.tsx` & `frontend/app/(app)/red-team/campaigns/page.tsx`)
- [ ] **Step 3.1**: Upgrade `frontend/app/(app)/red-team/page.tsx`:
  - Add Dataset Switcher: `Simulation Suite (3)` vs `Live Telemetry (N)`.
  - Add Pre-Flight Guidance Banner per `CONTEXT.md`.
  - Embed the `CrewAgentChainViz` to display the active multi-agent crew execution.
  - Provide intelligent zero-state fallback when live campaign telemetry is empty.
- [ ] **Step 3.2**: Upgrade `frontend/app/(app)/red-team/campaigns/page.tsx`:
  - Integrate dataset mode toggle with fallback to `DEMO_REDTEAM_CAMPAIGNS`.
  - Display the 6-agent handoff indicators on campaign cards.
- [ ] **Step 3.3**: Write unit test verifying dataset toggling and zero-state rendering.
- [ ] **Step 3.4**: Run `npm run typecheck` and `npm test` to verify.
- [ ] **Step 3.5**: Commit Task 3.

---

### Task 4: Full Verification & Verification Gates
- [ ] **Step 4.1**: Run `npm run typecheck`.
- [ ] **Step 4.2**: Run `npm run lint`.
- [ ] **Step 4.3**: Run full Vitest suite (`npm test`).
- [ ] **Step 4.4**: Run risk framework and documentation sync scripts.
- [ ] **Step 4.5**: Curl `http://localhost:3000/red-team` and `http://localhost:3000/red-team/campaigns` to verify HTTP 200 and clean rendering.
