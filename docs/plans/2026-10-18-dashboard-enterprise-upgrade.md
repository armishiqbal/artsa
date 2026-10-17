# ARTSA Enterprise Dashboard & Threat Forensics Upgrade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Overview

Transform ARTSA from feeling like an empty/generic monitoring scaffold into an elite, battle-tested AI Security Posture & Red Team Defense Operations Center (benchmarked against Lakera Guard/Red and enterprise AI posture platforms). Work is executed strictly **one by one** with full test verification at each step.

---

## Architecture & Principles
1. **Zero-State Intelligence**: When the operational database has 0 live findings, the UI must never render a blank, confusing screen. It must present a labeled **Pre-Flight Intelligence Benchmark (Demonstration Threat Suite)** covering OWASP ASI01–ASI10 and MITRE ATLAS vectors with realistic payloads, judge verdicts, and 1-click defense promotion.
2. **Context Integrity (CONTEXT.md)**: Strictly label demonstration data as `"Demonstration Suite · Pre-Flight Intelligence Benchmark"`, distinct from live operational telemetry, adhering to the claim contract.
3. **Pure White Enterprise Aesthetics**: Crisp typography, `bg-white`, slate borders (`border-slate-200`), dark badges, monospace forensics tokens, zero generic boilerplate.

---

## Tasks (Executed One-by-One)

### Task 1: Findings Zero-State & Interactive Threat Dossier (`/findings`)
- [x] **Step 1.1**: Define high-fidelity demonstration threat scenarios in a dedicated file (`frontend/lib/findingsDemoData.ts`) covering 5 major AI exploit classes:
  1. *Direct Prompt Injection & System Prompt Exfiltration* (OWASP ASI01 / ATLAS AML.T0054)
  2. *Indirect RAG Poisoning & Context Hijacking* (OWASP ASI01 / ATLAS AML.T0051)
  3. *Unauthorized Tool Execution & Cloud Metadata SSRF* (OWASP ASI04 / ATLAS AML.T0053)
  4. *Sensitive Data & API Token Exfiltration via Tool Args* (OWASP ASI02 / ATLAS AML.T0055)
  5. *Agentic Cascade & Session Circuit Breaker Trip* (OWASP ASI08 / ATLAS AML.T0052)
- [x] **Step 1.2**: Update [`frontend/app/(app)/findings/page.tsx`](file:///Users/haroonshahid/ARTSA-latest/frontend/app/(app)/findings/page.tsx) with:
  - An intelligent **Demonstration Banner & View Toggle**: Clearly allows switching between `Live Telemetry (0)` and `Pre-Flight Benchmark (5)`.
  - Educational guidance banner explaining the finding lifecycle (Research &rarr; Probe &rarr; Target &rarr; Scored Breach &rarr; Defender Hotpatch &rarr; Playbook).
  - Quick action to *"Launch Live Simulation Campaign"* directly targeting the selected finding vector.
- [x] **Step 1.3**: Enhance [`frontend/components/findings/FindingWorkbenchView.tsx`](file:///Users/haroonshahid/ARTSA-latest/frontend/components/findings/FindingWorkbenchView.tsx):
  - Add interactive payload highlighting with danger token badges.
  - Add Judge verdict breakdown cards (Confidence score, Canary breach trigger, Blast radius analysis).
  - Streamline the 1-click "Deploy Defense Hotpatch" button with immediate feedback.
- [x] **Step 1.4**: Run verification gates:
  - `npm run typecheck`
  - `npm test -- --passWithNoTests`
  - Live HTTP route verification (`http://localhost:3000/findings`).

---

### Task 2: Command Center Strategic AI Posture Cockpit (`/command-center`)
- [x] **Step 2.1**: Replace generic counters with an **Enterprise AI Resilience Scorecard**:
  - Global Resilience Score (0–100 gauge with posture rating: Strong / Defended / Critical Gaps).
  - Runtime Shield Pulse (screened requests, blocked attacks, p95 inspection latency).
  - Active Circuit Breakers & Session Quarantines (ASI08).
- [x] **Step 2.2**: Add an **Agent & Tool Blast Radius Shelf**:
  - Monitored agents, allowed tools vs gated MCP servers, and trip counters.
- [x] **Step 2.3**: Verify and test Task 2.

---

### Task 3: Adaptive Lift vs. Static Baseline Curve Polish
- [x] **Step 3.1**: Emphasize the core thesis in the detection-rate-over-time visualizer: highlight the **Adaptive Lift** percentage gap between self-improving Defender and the flat static baseline.
- [x] **Step 3.2**: End-to-end verification and review.
