import { describe, it, expect } from "vitest";
import {
  SIMULATED_INCIDENTS,
  SIMULATED_KPIS,
  deriveIncidentKpis,
} from "@/lib/incidentKpis";

describe("incidentKpis", () => {
  it("exports a realistic simulated feed with distinct sessions and verdicts", () => {
    expect(SIMULATED_INCIDENTS.length).toBeGreaterThanOrEqual(5);
    const sessions = new Set(SIMULATED_INCIDENTS.map((e) => e.session_id));
    expect(sessions.size).toBe(SIMULATED_INCIDENTS.length);
    for (const evt of SIMULATED_INCIDENTS) {
      expect(evt.tool_name.length).toBeGreaterThan(0);
      expect(evt.risk_score).toBeGreaterThanOrEqual(0);
      expect(evt.risk_score).toBeLessThanOrEqual(100);
      expect(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).toContain(evt.severity);
    }
  });

  it("marks the fallback baseline as simulated", () => {
    expect(SIMULATED_KPIS.simulated).toBe(true);
    expect(SIMULATED_KPIS.provider_risk_score).toBeGreaterThan(0);
    expect(SIMULATED_KPIS.provider_risk_score).toBeLessThanOrEqual(100);
  });

  it("returns the simulated baseline when there is no live data", () => {
    const kpis = deriveIncidentKpis(null, [], true);
    expect(kpis.simulated).toBe(true);
    expect(kpis).toEqual(SIMULATED_KPIS);
  });

  it("derives blocked prompt injections from live BLOCKED telemetry", () => {
    const liveEvents = [
      {
        tool_name: "web_search",
        verdict: "BLOCKED",
        flags: ["prompt_injection"],
        risk_score: 91,
        security_event_count: 1,
      },
      {
        tool_name: "read_file",
        verdict: "BLOCKED",
        flags: ["tool_misuse"],
        risk_score: 78,
        security_event_count: 0,
      },
      {
        tool_name: "send_email",
        verdict: "CLEAN",
        flags: [],
        risk_score: 12,
        security_event_count: 0,
      },
    ];
    const kpis = deriveIncidentKpis(null, liveEvents, false);
    expect(kpis.simulated).toBe(false);
    expect(kpis.blocked_prompt_injections).toBe(1);
    expect(kpis.tool_misuse_events).toBeGreaterThanOrEqual(1);
    // Average of the three risk scores (91 + 78 + 12) / 3 = 60
    expect(kpis.provider_risk_score).toBe(60);
  });

  it("falls back per-KPI when live events contain no signal", () => {
    const liveEvents = [
      { tool_name: "web_search", verdict: "CLEAN", flags: [], risk_score: 10, security_event_count: 0 },
    ];
    const kpis = deriveIncidentKpis(null, liveEvents, false);
    expect(kpis.simulated).toBe(false);
    expect(kpis.blocked_prompt_injections).toBe(SIMULATED_KPIS.blocked_prompt_injections);
    expect(kpis.tool_misuse_events).toBe(SIMULATED_KPIS.tool_misuse_events);
    expect(kpis.policy_violations).toBe(SIMULATED_KPIS.policy_violations);
    expect(kpis.provider_risk_score).toBe(10);
  });
});
