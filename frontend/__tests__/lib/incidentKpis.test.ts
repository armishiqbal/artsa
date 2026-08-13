import { describe, it, expect } from "vitest";
import { deriveIncidentKpis } from "@/lib/incidentKpis";

describe("incidentKpis (real data only)", () => {
  it("returns zero counts when there is no live data", () => {
    const kpis = deriveIncidentKpis(null, []);
    expect(kpis.blocked_prompt_injections).toBe(0);
    expect(kpis.tool_misuse_events).toBe(0);
    expect(kpis.policy_violations).toBe(0);
    expect(kpis.provider_risk_score).toBe(0);
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
    const kpis = deriveIncidentKpis(null, liveEvents);
    expect(kpis.blocked_prompt_injections).toBe(1);
    expect(kpis.tool_misuse_events).toBeGreaterThanOrEqual(1);
    // Average of the three risk scores (91 + 78 + 12) / 3 = 60
    expect(kpis.provider_risk_score).toBe(60);
  });

  it("never fabricates numbers — clean events yield zero counts", () => {
    const liveEvents = [
      { tool_name: "web_search", verdict: "CLEAN", flags: [], risk_score: 10, security_event_count: 0 },
    ];
    const kpis = deriveIncidentKpis(null, liveEvents);
    expect(kpis.blocked_prompt_injections).toBe(0);
    expect(kpis.tool_misuse_events).toBe(0);
    expect(kpis.policy_violations).toBe(0);
    expect(kpis.provider_risk_score).toBe(10);
  });

  it("uses metrics.avg_risk_score when no events carry risk scores", () => {
    const kpis = deriveIncidentKpis({ avg_risk_score: 44 }, []);
    expect(kpis.provider_risk_score).toBe(44);
  });
});
