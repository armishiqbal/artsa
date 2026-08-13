import { describe, it, expect } from "vitest";
import {
  CATEGORY_LABELS,
  DEFENSE_LAYER_LABELS,
  frameworkFromMetadata,
} from "@/lib/agenticRisks";
import type { AgenticRisk } from "@/lib/types";

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

describe("agentic risk framework helpers (real data only)", () => {
  it("builds zero-count framework rows from static metadata", () => {
    const meta = [
      {
        id: SAMPLE_ROW.id,
        rank: SAMPLE_ROW.rank,
        name: SAMPLE_ROW.name,
        description: SAMPLE_ROW.description,
        attack_categories: SAMPLE_ROW.attack_categories,
        defense_layers: SAMPLE_ROW.defense_layers,
        detectors: SAMPLE_ROW.detectors,
        mitigations: SAMPLE_ROW.mitigations,
      },
    ];
    const response = frameworkFromMetadata(meta);
    expect(response.total_events).toBe(0);
    expect(response.framework[0].live_events).toBe(0);
    expect(response.framework[0].blocked_events).toBe(0);
    expect(response.framework[0].severity).toBe("LOW");
  });

  it("maps every referenced category and defense layer to a label", () => {
    for (const cat of SAMPLE_ROW.attack_categories) {
      expect(CATEGORY_LABELS[cat]).toBeDefined();
    }
    for (const layer of SAMPLE_ROW.defense_layers) {
      expect(DEFENSE_LAYER_LABELS[layer]).toBeDefined();
    }
  });
});
