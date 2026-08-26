import { describe, expect, it } from "vitest";
import {
  buildAttackFlowModel,
  turnProgressIndex,
  verdictEdgeStatus,
} from "@/lib/redTeamAttackFlow";
import type { TranscriptTurn } from "@/lib/campaignTranscript";

function turn(partial: Partial<TranscriptTurn>): TranscriptTurn {
  return {
    roundNumber: 1,
    attackPrompt: "",
    attackName: "t",
    category: "DPI",
    asiCode: null,
    asiLabel: null,
    templateId: null,
    objective: null,
    mutationsApplied: [],
    targetResponse: "",
    blocked: false,
    blockedBy: null,
    targetError: false,
    errorDetail: null,
    verdict: "UNKNOWN",
    attackSuccessScore: 0,
    defenseQualityScore: 0,
    bypassDepth: 0,
    reasoning: "",
    severity: "MEDIUM",
    ...partial,
  };
}

describe("redTeamAttackFlow", () => {
  it("marks live active hop from phase", () => {
    const model = buildAttackFlowModel({
      phase: "attack",
      isRunning: true,
      turn: null,
      roundsCompleted: 2,
      maxRounds: 5,
    });
    expect(model.source).toBe("live-phase");
    expect(model.activeHopId).toBe("redteam");
    expect(model.hops.find((h) => h.id === "research")?.status).toBe("done");
    expect(model.hops.find((h) => h.id === "redteam")?.status).toBe("active");
    expect(model.hops.find((h) => h.id === "judge")?.status).toBe("pending");
  });

  it("derives turn progress and breached edges from transcript", () => {
    const t = turn({
      attackPrompt: "ignore prior",
      targetResponse: "ok",
      verdict: "ATTACK_SUCCESS",
      attackSuccessScore: 9,
    });
    expect(turnProgressIndex(t)).toBeGreaterThanOrEqual(4);
    expect(verdictEdgeStatus(t)).toBe("breached");

    const model = buildAttackFlowModel({
      phase: "complete",
      isRunning: false,
      turn: t,
      roundsCompleted: 5,
      maxRounds: 5,
    });
    expect(model.source).toBe("transcript");
    const probe = model.edges.find((e) => e.id === "redteam->target");
    expect(probe?.status).toBe("breached");
  });

  it("does not treat target ERROR as a defensive block", () => {
    expect(
      verdictEdgeStatus(
        turn({
          verdict: "ERROR",
          targetError: true,
          targetResponse: "[GENERATION ERROR]",
          attackPrompt: "x",
        })
      )
    ).toBe("active");
  });

  it("stays idle with no data", () => {
    const model = buildAttackFlowModel({
      phase: "recon",
      isRunning: false,
      turn: null,
      roundsCompleted: 0,
      maxRounds: 0,
    });
    expect(model.source).toBe("idle");
    expect(model.hops.every((h) => h.status === "pending")).toBe(true);
  });
});
