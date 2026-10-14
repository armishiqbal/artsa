import { describe, expect, it } from "vitest";
import {
  computeDetectionRate,
  deriveDetectionSeries,
  deriveAgentStatuses,
  deriveGraphModel,
  deriveMissionPosture,
  deriveVitals,
  filterEventsByWindow,
  recentActiveHops,
  telemetryToAgentEvents,
  type AgentEvent,
} from "@/lib/commandCenterOps";

const sample: AgentEvent[] = [
  {
    type: "message",
    timestamp: new Date().toISOString(),
    sourceAgent: "Red Team",
    targetAgent: "Target",
    severity: "info",
    message: "Red Team → Target: hop ack",
    hmacValid: true,
  },
  {
    type: "finding",
    timestamp: new Date().toISOString(),
    sourceAgent: "Defender",
    targetAgent: "Target",
    severity: "warning",
    asiTag: "ASI08",
    message: "Unauthorized tool call contained",
    hmacValid: true,
  },
  {
    type: "attack_start",
    timestamp: new Date().toISOString(),
    sourceAgent: "Red Team",
    targetAgent: "Target",
    status: "under_attack",
    severity: "critical",
    message: "Active attack path opened against Target",
  },
];

describe("commandCenterOps", () => {
  it("keeps recent events in the analysis window", () => {
    expect(filterEventsByWindow(sample, "15m")).toHaveLength(3);
  });

  it("builds six-agent graph with traffic links", () => {
    const g = deriveGraphModel(sample, "all", "all");
    expect(g.nodes.some((n) => n.id === "Red Team")).toBe(true);
    expect(g.links.length).toBeGreaterThan(0);
    expect(g.links.some((l) => l.hot)).toBe(true);
  });

  it("derives vitals from the same stream", () => {
    const v = deriveVitals(sample);
    expect(v.findingsInWindow).toBeGreaterThan(0);
    expect(v.detectionRate).toBeNull();
  });

  it("preserves telemetry evidence and does not infer missing classifications", () => {
    const mapped = telemetryToAgentEvents([
      {
        timestamp: new Date().toISOString(),
        agent_id: "red-team-1",
        tool_name: "user_prompt",
        risk_score: 88,
        verdict: "BREACHED",
      },
    ]);
    expect(mapped[0]?.severity).toBeUndefined();
    expect(mapped[0]?.sourceAgent).toBe("red-team-1");
    expect(mapped[0]?.targetAgent).toBeUndefined();
    expect(mapped[0]?.status).toBeUndefined();
    expect(mapped[0]?.asiTag).toBeUndefined();
    expect(mapped[0]?.hmacValid).toBeUndefined();
  });

  it("drops records without a valid source timestamp instead of inventing one", () => {
    expect(telemetryToAgentEvents([{ agent_id: "red_team", risk_score: 88 }])).toEqual([]);
  });

  it("derives elevated/critical mission posture from pressure", () => {
    const elevated = deriveMissionPosture(sample);
    expect(["elevated", "critical"]).toContain(elevated.posture);
    expect(elevated.headline.length).toBeGreaterThan(10);

    const quiet = deriveMissionPosture([
      {
        type: "message",
        timestamp: new Date().toISOString(),
        sourceAgent: "Judge",
        targetAgent: "Curator",
        severity: "info",
        message: "quiet hop",
      },
    ]);
    expect(quiet.posture).toBe("unknown");
  });

  it("keeps missing agent state unknown when no events have been recorded", () => {
    const status = deriveAgentStatuses([]);
    expect(Object.values(status).every((value) => value === "unknown")).toBe(true);
    expect(deriveMissionPosture([]).posture).toBe("unknown");
  });

  it("does not derive a detection rate or history from unqualified event rows", () => {
    const rate = computeDetectionRate(sample);
    const vitals = deriveVitals(sample);
    const series = deriveDetectionSeries(sample);
    expect(rate).toBeNull();
    expect(vitals.detectionRate).toBeNull();
    expect(series).toEqual([]);
  });

  it("flags recent hops for edge pulse", () => {
    const hops = recentActiveHops(sample, 10, 60_000);
    expect(hops.has("Red Team→Target")).toBe(true);
  });
});
