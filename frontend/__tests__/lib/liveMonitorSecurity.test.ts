import { describe, it, expect } from "vitest";
import { deriveRoundSecurity, pathNodesForTurn } from "@/lib/liveMonitorSecurity";
import type { TranscriptTurn } from "@/lib/campaignTranscript";

function turn(partial: Partial<TranscriptTurn>): TranscriptTurn {
  return {
    roundNumber: 1,
    attackPrompt: "ignore previous",
    attackName: "Prompt Injection",
    category: "injection",
    asiCode: null,
    asiLabel: null,
    templateId: null,
    objective: null,
    mutationsApplied: [],
    targetResponse: "ok",
    blocked: false,
    blockedBy: null,
    targetError: false,
    errorDetail: null,
    verdict: "SAFE",
    attackSuccessScore: 0.1,
    defenseQualityScore: 0.9,
    bypassDepth: 0,
    reasoning: "",
    severity: "LOW",
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

describe("liveMonitorSecurity v2 axes", () => {
  it("returns null when there is no round (no fake pass lights)", () => {
    expect(deriveRoundSecurity(null)).toBeNull();
  });

  it("keeps detection miss distinct from confirmed leak", () => {
    const s = deriveRoundSecurity(
      turn({
        blocked: false,
        defenseQualityScore: 0.1,
        attackSuccessScore: 0.2,
        verdict: "PARTIAL",
      })
    );
    expect(s).not.toBeNull();
    expect(s!.detection).toBe("late");
    expect(s!.leak).toBe("none");
    expect(s!.dataSafe).toBe(true);
  });

  it("flags confirmed leak on high attack success", () => {
    const s = deriveRoundSecurity(
      turn({
        blocked: false,
        defenseQualityScore: 0.1,
        attackSuccessScore: 0.85,
        verdict: "SUCCESS",
      })
    );
    expect(s).not.toBeNull();
    expect(s!.leak).toBe("confirmed");
    expect(s!.result).toBe("critical");
  });

  it("lights path nodes from round content", () => {
    const nodes = pathNodesForTurn(turn({}));
    expect(nodes.find((n) => n.id === "input")?.active).toBe(true);
    expect(nodes.find((n) => n.id === "outcome")?.active).toBe(true);
  });

  it("keeps path pending when no turn", () => {
    const nodes = pathNodesForTurn(null);
    expect(nodes.every((n) => !n.active)).toBe(true);
  });
});
