import { describe, it, expect } from "vitest";
import {
  severityFromRiskScore,
  toScore05,
  deriveAssessmentRiskOverview,
  deriveAssessmentCategoryRows,
  deriveAssessmentTestRows,
  compareAssessmentResults,
  lensForCategory,
  riskScoreFromSummary,
} from "@/lib/assessmentResults";
import type { TranscriptTurn } from "@/lib/campaignTranscript";

const turn = (partial: Partial<TranscriptTurn>): TranscriptTurn => ({
  roundNumber: 1,
  attackPrompt: "x",
  attackName: "probe",
  category: "DPI",
  asiCode: "ASI01",
  asiLabel: "Goal hijack",
  templateId: null,
  objective: null,
  mutationsApplied: [],
  targetResponse: "y",
  blocked: false,
  blockedBy: null,
  targetError: false,
  errorDetail: null,
  verdict: "BLOCKED",
  attackSuccessScore: 2,
  defenseQualityScore: 8,
  bypassDepth: 1,
  reasoning: "",
  severity: "LOW",
  ...partial,
});

describe("assessmentResults", () => {
  it("maps severity bands from risk %", () => {
    expect(severityFromRiskScore(10)).toBe("Low");
    expect(severityFromRiskScore(40)).toBe("Medium");
    expect(severityFromRiskScore(60)).toBe("High");
    expect(severityFromRiskScore(90)).toBe("Critical");
  });

  it("scales attack success to 0–5", () => {
    expect(toScore05(10)).toBe(5);
    expect(toScore05(0)).toBe(0);
  });

  it("derives risk overview from turns", () => {
    const overview = deriveAssessmentRiskOverview([
      turn({ verdict: "SUCCESS", attackSuccessScore: 8 }),
      turn({ roundNumber: 2, verdict: "BLOCKED", attackSuccessScore: 1 }),
    ]);
    expect(overview.totalEvaluations).toBe(2);
    expect(overview.harmfulCount).toBe(1);
    expect(overview.riskScore).toBe(50);
    expect(overview.severity).toBe("Medium");
  });

  it("groups by risk lens", () => {
    expect(lensForCategory("DPI")).toBe("Security");
    const rows = deriveAssessmentCategoryRows([
      turn({ category: "DPI", verdict: "SUCCESS", attackSuccessScore: 9 }),
      turn({ roundNumber: 2, category: "JBK", verdict: "BLOCKED", attackSuccessScore: 1 }),
    ]);
    expect(rows.some((r) => r.lens === "Security")).toBe(true);
    expect(rows.find((r) => r.lens === "Security")?.total).toBe(2);
  });

  it("builds by-test rows", () => {
    const rows = deriveAssessmentTestRows([
      turn({ roundNumber: 2, attackName: "b" }),
      turn({ roundNumber: 1, attackName: "a" }),
    ]);
    expect(rows[0]?.roundNumber).toBe(1);
    expect(rows[0]?.name).toBe("a");
  });

  it("compares two result sets", () => {
    const a = [turn({ verdict: "SUCCESS", attackSuccessScore: 9 })];
    const b = [turn({ verdict: "BLOCKED", attackSuccessScore: 1 })];
    const delta = compareAssessmentResults(a, b);
    expect(delta.riskDelta).toBe(-100);
  });

  it("derives risk from summary verdicts", () => {
    expect(
      riskScoreFromSummary({
        results_by_verdict: { SUCCESS: 1, BLOCKED: 3 },
      })
    ).toBe(25);
  });
});
