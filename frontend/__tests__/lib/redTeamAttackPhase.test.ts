import { describe, it, expect } from "vitest";
import { deriveAttackPhase, attackPhases } from "@/lib/redTeamAttackPhase";

describe("redTeamAttackPhase", () => {
  it("lists adversarial agent phases", () => {
    expect(attackPhases().map((p) => p.agent)).toContain("Red Team");
    expect(attackPhases().map((p) => p.agent)).toContain("Judge");
  });

  it("maps run progress to phases", () => {
    expect(
      deriveAttackPhase({
        isRunning: true,
        completed: false,
        roundsCompleted: 0,
        maxRounds: 5,
        hasTurns: false,
      })
    ).toBe("arm");
    expect(
      deriveAttackPhase({
        isRunning: false,
        completed: true,
        roundsCompleted: 5,
        maxRounds: 5,
        hasTurns: true,
      })
    ).toBe("complete");
  });

  it("prefers transcript evidence while running", () => {
    expect(
      deriveAttackPhase({
        isRunning: true,
        completed: false,
        roundsCompleted: 1,
        maxRounds: 5,
        hasTurns: true,
        turn: { attackPrompt: "p", targetResponse: "", verdict: "UNKNOWN" },
      })
    ).toBe("respond");
    expect(
      deriveAttackPhase({
        isRunning: true,
        completed: false,
        roundsCompleted: 1,
        maxRounds: 5,
        hasTurns: true,
        turn: { attackPrompt: "p", targetResponse: "r", verdict: "UNKNOWN" },
      })
    ).toBe("judge");
  });
});
