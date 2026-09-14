import { describe, expect, it } from "vitest";
import { parseGuardAssessment, promptPreview, resolveRunNature, terminalAssessment } from "@/lib/guardAssessment";

describe("guard assessment contract", () => {
  it("accepts a complete version-one payload", () => {
    const assessment = terminalAssessment("run-1", "unavailable", "session-1");
    expect(parseGuardAssessment(assessment, "run-1")).toEqual(assessment);
  });

  it("rejects mismatched, incomplete, and malformed payloads", () => {
    const assessment = terminalAssessment("run-1", "unavailable", "session-1");
    expect(parseGuardAssessment(assessment, "run-2")).toBeNull();
    expect(parseGuardAssessment({ ...assessment, categories: assessment.categories.slice(1) })).toBeNull();
    expect(parseGuardAssessment({ ...assessment, riskScore: Number.NaN })).toBeNull();
    expect(parseGuardAssessment({
      ...assessment,
      categories: assessment.categories.map((category) => category.category === "unknown_links" ? { ...category, status: "not_detected", action: "ALLOW" } : category),
    })).toBeNull();
  });

  it("keeps previews memory-safe and bounded", () => {
    expect(promptPreview("a\n  b")).toBe("a b");
    expect(promptPreview("x".repeat(200))).toHaveLength(160);
  });

  it("correctly resolves run execution nature", () => {
    const assessment = terminalAssessment("run-1", "unavailable", "session-1");
    expect(
      resolveRunNature({
        id: "run-1",
        submittedAt: new Date().toISOString(),
        promptPreview: "hello",
        status: "unavailable",
      })
    ).toBe("Not evaluated");

    expect(
      resolveRunNature({
        id: "run-2",
        submittedAt: new Date().toISOString(),
        promptPreview: "Template: prompt injection test",
        status: "passed",
        assessment,
        nature: "Fixture",
      })
    ).toBe("Fixture");

    expect(
      resolveRunNature({
        id: "run-3",
        submittedAt: new Date().toISOString(),
        promptPreview: "Live attack scenario",
        status: "flagged",
        assessment: { ...assessment, outcome: "flagged" },
        providerId: "openai-gpt-4o",
      })
    ).toBe("Live");

    expect(
      resolveRunNature({
        id: "run-4",
        submittedAt: new Date().toISOString(),
        promptPreview: "Simulated scenario",
        status: "passed",
        assessment: { ...assessment, outcome: "passed" },
        providerId: "simulated",
      })
    ).toBe("Simulated");
  });
});
