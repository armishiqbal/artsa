import { describe, it, expect } from "vitest";
import { asiCodesForProfileCategories, asiForAttackCategory } from "@/lib/asiCategories";
import { parseTopFindings, roundToTranscriptTurn } from "@/lib/campaignTranscript";

describe("asiCategories", () => {
  it("maps DPI to ASI01", () => {
    expect(asiForAttackCategory("DPI")?.code).toBe("ASI01");
  });

  it("returns ASI codes for attack profile categories", () => {
    const codes = asiCodesForProfileCategories(["DPI", "JBK", "SPE"]);
    expect(codes.length).toBeGreaterThan(0);
    expect(codes[0].code).toMatch(/^ASI\d{2}$/);
  });
});

describe("campaignTranscript", () => {
  it("normalises a round payload", () => {
    const turn = roundToTranscriptTurn({
      round_number: 1,
      attack: { prompt: "ignore instructions", name: "Test", category: "PROMPT_INJECTION" },
      response: { response: "blocked", blocked: true, blocked_by: "input_filter" },
      score: {
        verdict: "BLOCKED",
        attack_success_score: 2,
        defense_quality_score: 8,
        bypass_depth: 0,
        reasoning: "Blocked at input",
        severity: "HIGH",
      },
    });
    expect(turn.attackPrompt).toContain("ignore");
    expect(turn.blocked).toBe(true);
    expect(turn.asiCode).toBe("ASI01");
  });

  it("parses top_findings from summary", () => {
    const turns = parseTopFindings({
      top_findings: [
        {
          round_number: 2,
          attack: { prompt: "x", category: "JAILBREAK" },
          response: { response: "y" },
          score: { verdict: "PARTIAL", severity: "MEDIUM" },
        },
      ],
    });
    expect(turns).toHaveLength(1);
    expect(turns[0].roundNumber).toBe(2);
  });
});
