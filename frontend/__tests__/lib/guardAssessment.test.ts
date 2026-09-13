import { describe, expect, it } from "vitest";
import { parseGuardAssessment, promptPreview, terminalAssessment } from "@/lib/guardAssessment";

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
});
