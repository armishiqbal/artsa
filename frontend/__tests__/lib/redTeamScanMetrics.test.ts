import { describe, it, expect } from "vitest";
import { deriveScanMetrics } from "@/lib/redTeamScanMetrics";
import type { TranscriptTurn } from "@/lib/campaignTranscript";

function turn(partial: Partial<TranscriptTurn> & { roundNumber: number }): TranscriptTurn {
  return {
    attackPrompt: "ignore",
    attackName: "Test",
    category: "PROMPT_INJECTION",
    asiCode: "ASI01",
    asiLabel: "Goal hijack",
    targetResponse: "ok",
    blocked: false,
    blockedBy: null,
    verdict: "ATTACK_SUCCESS",
    attackSuccessScore: 8,
    defenseQualityScore: 2,
    bypassDepth: 2,
    reasoning: "",
    severity: "HIGH",
    ...partial,
  };
}

describe("redTeamScanMetrics", () => {
  it("counts findings and derives verdicts from turns", () => {
    const metrics = deriveScanMetrics(null, [
      turn({ roundNumber: 1 }),
      turn({ roundNumber: 2, verdict: "BLOCKED", attackSuccessScore: 1 }),
    ]);
    expect(metrics.findingsCount).toBe(1);
    expect(metrics.verdicts.ATTACK_SUCCESS).toBe(1);
    expect(metrics.verdicts.BLOCKED).toBe(1);
  });

  it("reads summary averages when present", () => {
    const metrics = deriveScanMetrics(
      { avg_attack_success: 4.2, avg_defense_quality: 7.1, completed_rounds: 5 },
      []
    );
    expect(metrics.avgAttackSuccess).toBe("4.2");
    expect(metrics.avgDefenseQuality).toBe("7.1");
    expect(metrics.roundsCompleted).toBe(5);
  });
});
