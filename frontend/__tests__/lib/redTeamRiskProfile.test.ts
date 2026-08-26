import { describe, it, expect } from "vitest";
import {
  buildCategoryRiskProfile,
  overallRiskBand,
} from "@/lib/redTeamRiskProfile";
import type { TranscriptTurn } from "@/lib/campaignTranscript";

function turn(partial: Partial<TranscriptTurn> & { roundNumber: number }): TranscriptTurn {
  return {
    attackPrompt: "x",
    attackName: "Test",
    category: "PROMPT_INJECTION",
    asiCode: "ASI01",
    asiLabel: "Agent Goal Hijack",
    templateId: null,
    objective: null,
    mutationsApplied: [],
    targetResponse: "y",
    blocked: false,
    blockedBy: null,
    targetError: false,
    errorDetail: null,
    verdict: "ATTACK_SUCCESS",
    attackSuccessScore: 8,
    defenseQualityScore: 2,
    bypassDepth: 3,
    reasoning: "",
    severity: "HIGH",
    ...partial,
  };
}

describe("redTeamRiskProfile", () => {
  it("groups turns by ASI category and scores risk", () => {
    const rows = buildCategoryRiskProfile([
      turn({ roundNumber: 1, attackSuccessScore: 8, verdict: "ATTACK_SUCCESS" }),
      turn({ roundNumber: 2, attackSuccessScore: 2, verdict: "BLOCKED" }),
    ]);
    expect(rows.length).toBe(1);
    expect(rows[0].rounds).toBe(2);
    expect(rows[0].successCount).toBe(1);
    expect(rows[0].band).toBe("high");
  });

  it("derives overall band from category rows", () => {
    const rows = buildCategoryRiskProfile([
      turn({ roundNumber: 1, attackSuccessScore: 1, verdict: "BLOCKED" }),
    ]);
    expect(overallRiskBand(rows)).toBe("low");
    expect(overallRiskBand([])).toBe("none");
  });
});
