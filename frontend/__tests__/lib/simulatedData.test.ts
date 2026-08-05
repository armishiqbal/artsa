import { describe, it, expect } from "vitest";
import {
  SIMULATED_SESSIONS,
  SIMULATED_TIMELINES,
  SIMULATED_OBSERVATORY,
  SIMULATED_CAMPAIGNS,
  SIMULATED_TOPOLOGY,
} from "@/lib/simulatedData";

describe("simulated sessions + timelines (Replay)", () => {
  it("exports sessions with valid risk/status shapes", () => {
    expect(SIMULATED_SESSIONS.length).toBeGreaterThanOrEqual(3);
    for (const s of SIMULATED_SESSIONS) {
      expect(s.id.length).toBeGreaterThan(0);
      expect(s.max_risk_score).toBeGreaterThanOrEqual(0);
      expect(s.max_risk_score).toBeLessThanOrEqual(100);
      expect(["ACTIVE", "CLOSED", "BREACHED"]).toContain(s.status);
    }
  });

  it("every simulated session has a non-empty timeline", () => {
    for (const s of SIMULATED_SESSIONS) {
      const timeline = SIMULATED_TIMELINES[s.id];
      expect(timeline).toBeDefined();
      expect(timeline!.length).toBeGreaterThan(0);
    }
  });

  it("timeline entries carry events and containment evaluations", () => {
    const first = SIMULATED_TIMELINES[SIMULATED_SESSIONS[0].id][0];
    expect(first.event.tool_name.length).toBeGreaterThan(0);
    expect(typeof first.evaluation.risk_score).toBe("number");
    expect(first.evaluation.flags).toBeInstanceOf(Array);
  });
});

describe("simulated observatory", () => {
  it("has a populated 30-day heatmap", () => {
    expect(SIMULATED_OBSERVATORY.heatmap.length).toBeGreaterThanOrEqual(20);
    for (const cell of SIMULATED_OBSERVATORY.heatmap) {
      expect(cell.intensity).toBeGreaterThanOrEqual(0);
      expect(cell.intensity).toBeLessThanOrEqual(4);
    }
  });

  it("Red Queen shows blue adaptation overtaking attack success", () => {
    const gens = SIMULATED_OBSERVATORY.red_queen;
    expect(gens.length).toBeGreaterThanOrEqual(5);
    const first = gens[0];
    const last = gens[gens.length - 1];
    expect(first.attack_success).toBeGreaterThan(first.blue_adaptation);
    expect(last.blue_adaptation).toBeGreaterThan(last.attack_success);
  });

  it("ablation deltas are all non-positive (disabling detectors never helps)", () => {
    for (const row of SIMULATED_OBSERVATORY.ablation.ablation) {
      expect(row.recall_delta_vs_baseline).toBeLessThanOrEqual(0);
    }
  });
});

describe("simulated campaigns (Reports)", () => {
  it("provides completed campaigns with verdict breakdowns", () => {
    expect(SIMULATED_CAMPAIGNS.length).toBeGreaterThanOrEqual(2);
    for (const c of SIMULATED_CAMPAIGNS) {
      expect(c.status).toBe("COMPLETED");
      expect(c.rounds_completed).toBe(c.total_rounds);
      const by = c.summary.results_by_verdict;
      expect(by.SUCCESS + by.PARTIAL + by.BLOCKED).toBe(c.total_rounds);
      expect(Object.keys(c.summary.results_by_category).length).toBeGreaterThan(0);
    }
  });
});

describe("simulated topology", () => {
  it("has agents, tools, and lateral-movement edges", () => {
    const agentNodes = SIMULATED_TOPOLOGY.nodes.filter((n) => n.type === "agent");
    const toolNodes = SIMULATED_TOPOLOGY.nodes.filter((n) => n.type === "tool");
    expect(agentNodes.length).toBeGreaterThanOrEqual(3);
    expect(toolNodes.length).toBeGreaterThanOrEqual(3);
    expect(SIMULATED_TOPOLOGY.edges.some((e) => e.type === "lateral_movement")).toBe(true);
  });

  it("every edge references existing node ids", () => {
    const ids = new Set(SIMULATED_TOPOLOGY.nodes.map((n) => n.id));
    for (const e of SIMULATED_TOPOLOGY.edges) {
      expect(ids.has(e.source)).toBe(true);
      expect(ids.has(e.target)).toBe(true);
    }
  });

  it("threat rows align with the simulated incident feed", () => {
    expect(SIMULATED_TOPOLOGY.threats.length).toBeGreaterThanOrEqual(3);
    for (const t of SIMULATED_TOPOLOGY.threats) {
      expect(t.risk_score).toBeGreaterThanOrEqual(0);
      expect(t.risk_score).toBeLessThanOrEqual(100);
    }
  });
});
