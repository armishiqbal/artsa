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
      attack: {
        prompt: "ignore instructions",
        name: "Test",
        category: "PROMPT_INJECTION",
        template_id: "dpi-basic-1",
        objective: "Hijack goal",
        mutations_applied: ["base64"],
      },
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
    expect(turn.templateId).toBe("dpi-basic-1");
    expect(turn.objective).toBe("Hijack goal");
    expect(turn.mutationsApplied).toEqual(["base64"]);
  });

  it("flags target API failures as ERROR not blocked", () => {
    const turn = roundToTranscriptTurn({
      round_number: 1,
      attack: { prompt: "x", name: "T", category: "DPI" },
      response: {
        response: "[GENERATION ERROR]",
        blocked: false,
        error: true,
        error_detail: "402 Insufficient Balance",
      },
      score: { verdict: "ERROR", attack_success_score: 0, defense_quality_score: 0 },
    });
    expect(turn.targetError).toBe(true);
    expect(turn.blocked).toBe(false);
    expect(turn.verdict).toBe("ERROR");
    expect(turn.errorDetail).toContain("402");
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
