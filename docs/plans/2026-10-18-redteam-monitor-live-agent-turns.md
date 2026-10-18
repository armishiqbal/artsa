# Spec & Implementation Plan: Live Campaign Multi-Agent Turn Cards & 6-Agent Monitor

**Date**: 2026-10-18  
**Initiative**: Upgrade Live Campaign Execution Monitor (`/red-team/monitor/[id]`) with real-time multi-agent turn cards and CrewAI 6-agent chain observation (`Research` → `Curator` → `Red Team` → `Target` → `Judge` → `Defender`).

---

## 1. Context & Motivation

ARTSA's Red Team War Room has upgraded to the canonical CrewAI 6-agent pipeline (`ADR-008` & `CONTEXT.md`).
However, the live campaign theater at `/red-team/monitor/[id]`:
1. Previously only visualized a 4-step path (`Red Team` → `Target` → `Judge` → `Defender as Outcome`).
2. Lacked detailed per-round turn cards showing the sequential handoffs, tools executed, and HMAC token validation between agents.
3. Did not natively support direct inspection of the 3 Pre-Flight Simulation Suite campaigns (`camp-demo-01`, `camp-demo-02`, `camp-demo-03`).

---

## 2. Capability Map

| Module id | Responsibility | Depends on |
| :--- | :--- | :--- |
| `campaign-demo-loader` | Resolve demo campaigns & pre-flight turn events when viewing `camp-demo-*` in monitor | `redTeamDemoData` |
| `attack-viz-6agent` | Upgrade `CampaignAttackVizModel` and `buildCampaignAttackViz` to support all 6 agents | `liveMonitorEvents` |
| `live-agent-turn-cards` | Build `LiveAgentTurnCards.tsx` showing chronological agent turns per selected round with HMAC tokens, role badges, payloads, and verdicts | `redTeamDemoData`, `liveMonitorEvents` |
| `monitor-theater-integration` | Wire `LiveAgentTurnCards`, 6-agent `CampaignAttackViz`, demo resolver, and guidance banner into `/red-team/monitor/[id]/page.tsx` | `live-agent-turn-cards`, `attack-viz-6agent` |

---

## 3. Detailed Specifications

### 3.1 Pre-Flight Multi-Agent Simulation Events (`redTeamDemoData.ts`)
- Ensure each demo campaign (`camp-demo-01`, `camp-demo-02`, `camp-demo-03`) has realistic round events capturing all 6 agents across multiple rounds.
- Each event specifies:
  - `actor`: `"research" | "curator" | "red_team" | "target" | "judge" | "defender"`
  - `kind`: `"attack" | "response" | "verdict" | "agent_status"`
  - `summary`: Concrete description of tool invocation or decision.
  - `hmac_token`: Cryptographic SHA-256 custody token.
  - `payload_preview` or `tool_name` when applicable.

### 3.2 6-Agent Attack Visualizer (`campaignAttackViz.ts`)
- Upgrade `CampaignPathNode['id']`: `"research" | "curator" | "red_team" | "target" | "judge" | "defender"`.
- Compute active and hot states for Research, Curator, Red Team, Target, Judge, and Defender from round events.
- Update `CampaignAttackViz.tsx` to render all 6 stages smoothly on desktop and mobile.

### 3.3 Multi-Agent Turn Cards (`LiveAgentTurnCards.tsx`)
- Given `selectedRound` and `events` (stream or demo):
  - Filter events for `selectedRound` (or latest round if none selected).
  - Group into distinct agent turns:
    - **Hop 1: Research Agent** (`Reconnaissance & Boundary Probing`)
    - **Hop 2: Curator Agent** (`Payload Matrix Synthesis`)
    - **Hop 3: Red Team Agent** (`Offensive Probe Dispatch`)
    - **Hop 4: Target Agent** (`Execution & Tool Invocations`)
    - **Hop 5: Judge Agent** (`Evaluation & Risk Scoring`)
    - **Hop 6: Defender Agent** (`Containment & Circuit Breakers`, if breached)
  - Card Layout:
    - Left indicator with agent icon and hop sequence badge (`Hop 1/6`, `Hop 2/6`, etc.).
    - Header with Agent Name, Specialization Role, Timestamp, and HMAC Token verification badge (`HMAC Verified`).
    - Body with the action summary, prompt / payload / response snippet, and active tools badge.
    - Status pill: `Executing`, `Safe Refusal`, `Breach Detected`, `Contained`.

### 3.4 Live Monitor Theater Page (`/red-team/monitor/[id]/page.tsx`)
- Resolve campaign from `campaigns` OR `getDemoCampaign(id)`.
- If demo campaign:
  - Display Pre-Flight Guidance Banner (`Pre-Flight Multi-Agent Simulation · Labeled Demonstration Suite`).
  - Feed events from `getDemoCampaignEvents(id)`.
- Embed `<LiveAgentTurnCards />` right below the round selector rail and before the raw event log.
- Allow 1-click round switching to instantly inspect turns in any round.

---

## 4. Verification & Testing Strategy

1. **Unit Tests**:
   - `campaignAttackViz.test.ts`: Test that `buildCampaignAttackViz` correctly populates 6-agent path nodes and round outcomes.
   - `liveAgentTurnCards.test.tsx`: Test rendering of agent turns, HMAC tokens, tool tags, and outcome verdicts for selected rounds.
   - `monitorPage.test.tsx`: Test `/red-team/monitor/[id]` rendering with both demo campaigns and live campaigns.
2. **Quality Gates**:
   - `npm run typecheck`
   - `npm run lint`
   - `npm test` across all 75+ test suites
   - Risk & doc sync checks
   - Live HTTP probe on `/red-team/monitor/camp-demo-01`
