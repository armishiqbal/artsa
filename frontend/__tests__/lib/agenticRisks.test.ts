import { describe, it, expect } from "vitest";
import {
  CATEGORY_LABELS,
  DEFENSE_LAYER_LABELS,
  shouldUseSimulatedRiskDemo,
  withSimulatedRiskCounts,
} from "@/lib/agenticRisks";
import { severityFromScore } from "@/lib/severity";
import type { AgenticRisk, RiskFrameworkResponse } from "@/lib/types";

const SAMPLE_ROW: AgenticRisk = {
  id: "agent-goal-hijack",
  rank: 1,
  name: "Agent Goal Hijack",
  description: "Test risk",
  attack_categories: ["DPI", "IPI"],
  defense_layers: ["statistical_inspector", "goal_drift_classifier"],
  detectors: ["Prompt Injection Detector"],
  mitigations: ["Sandbox tools"],
  live_events: 0,
  blocked_events: 0,
  breached_events: 0,
  max_risk_score: 0,
  severity: "LOW",
};

describe("agentic risk framework helpers", () => {
  it("uses simulated demo when pipeline is idle or has no flag matches", () => {
    expect(shouldUseSimulatedRiskDemo(null)).toBe(true);
    expect(
      shouldUseSimulatedRiskDemo({
        framework: [SAMPLE_ROW],
        total_events: 0,
        generated_at: null,
      })
    ).toBe(true);
    expect(
      shouldUseSimulatedRiskDemo({
        framework: [{ ...SAMPLE_ROW, live_events: 0 }],
        total_events: 12,
        generated_at: null,
      })
    ).toBe(true);
    expect(
      shouldUseSimulatedRiskDemo({
        framework: [{ ...SAMPLE_ROW, live_events: 3 }],
        total_events: 3,
        generated_at: null,
      })
    ).toBe(false);
  });

  it("overlays demonstration counters onto API rows", () => {
    const api: RiskFrameworkResponse = {
      framework: [SAMPLE_ROW],
      total_events: 0,
      generated_at: null,
    };
    const demo = withSimulatedRiskCounts(api);
    expect(demo.total_events).toBe(161);
    expect(demo.framework[0].live_events).toBeGreaterThan(0);
    expect(demo.framework[0].blocked_events).toBeLessThanOrEqual(demo.framework[0].live_events);
    expect(demo.framework[0].severity).toBe(severityFromScore(demo.framework[0].max_risk_score));
  });

  it("maps every referenced category and defense layer to a label", () => {
    const api: RiskFrameworkResponse = {
      framework: [SAMPLE_ROW],
      total_events: 0,
      generated_at: null,
    };
    const demo = withSimulatedRiskCounts(api);
    for (const risk of demo.framework) {
      for (const cat of risk.attack_categories) {
        expect(CATEGORY_LABELS[cat]).toBeDefined();
      }
      for (const layer of risk.defense_layers) {
        expect(DEFENSE_LAYER_LABELS[layer]).toBeDefined();
      }
    }
  });
});
