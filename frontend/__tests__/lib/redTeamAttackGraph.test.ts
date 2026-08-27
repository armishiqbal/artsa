import { describe, it, expect } from "vitest";
import { buildAttackGraph } from "@/lib/redTeamAttackGraph";
import type { TranscriptTurn } from "@/lib/campaignTranscript";

function turn(partial: Partial<TranscriptTurn>): TranscriptTurn {
  return {
    roundNumber: 1,
    attackPrompt: "ignore previous instructions",
    attackName: "Prompt Injection",
    category: "DPI",
    asiCode: "ASI01",
    asiLabel: "Agent Goal Hijack",
    templateId: null,
    objective: null,
    mutationsApplied: [],
    targetResponse: "I will help with that",
    blocked: false,
    blockedBy: null,
    targetError: false,
    errorDetail: null,
    verdict: "SUCCESS",
    attackSuccessScore: 0.85,
    defenseQualityScore: 0.1,
    bypassDepth: 2,
    reasoning: "tool call attempted",
    severity: "CRITICAL",
    timestamp: null,
    durationMs: 0,
    latencyMs: 0,
    informationLeakageScore: 0,
    mitreAtlas: null,
    owaspLlm: null,
    guardrailTrace: [],
    ...partial,
  };
}

describe("buildAttackGraph", () => {
  it("marks stages reached and counts confirmed leaks at outcome", () => {
    const graph = buildAttackGraph([turn({})]);
    expect(graph.stages.find((s) => s.id === "input")?.tested).toBe(1);
    expect(graph.stages.find((s) => s.id === "outcome")?.tone).toBe("breached");
    expect(graph.criticalLeaks).toBe(1);
  });

  it("keeps idle stages when no turns", () => {
    const graph = buildAttackGraph([]);
    expect(graph.stages.every((s) => s.tone === "idle")).toBe(true);
    expect(graph.criticalLeaks).toBe(0);
  });

  it("treats blocked low-success rounds as contained at outcome", () => {
    const graph = buildAttackGraph([
      turn({
        blocked: true,
        attackSuccessScore: 0.1,
        defenseQualityScore: 0.9,
        verdict: "BLOCKED",
        severity: "LOW",
      }),
    ]);
    expect(graph.pathContained).toBeGreaterThanOrEqual(1);
    expect(graph.criticalLeaks).toBe(0);
  });
});
