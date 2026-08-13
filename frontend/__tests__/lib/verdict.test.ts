import { describe, it, expect } from "vitest";
import { verdictSummary, complianceMapping } from "@/lib/verdict";

describe("verdictSummary", () => {
  it("treats low scores / SAFE as allowed", () => {
    const s = verdictSummary({ verdict: "SAFE", riskScore: 10 });
    expect(s.label).toBe("Safe");
    expect(s.blocked).toBe(false);
    expect(s.severity).toBe("LOW");
  });

  it("treats critical scores as blocked and quarantined", () => {
    const s = verdictSummary({ verdict: "BREACHED", riskScore: 92 });
    expect(s.label).toBe("Blocked");
    expect(s.blocked).toBe(true);
    expect(s.severity).toBe("CRITICAL");
    expect(s.whatWeDid.toLowerCase()).toContain("quarantined");
  });

  it("marks a suspicious verdict blocked when the action is QUARANTINE", () => {
    const s = verdictSummary({
      verdict: "SUSPICIOUS",
      riskScore: 60,
      recommendedAction: "QUARANTINE",
    });
    expect(s.blocked).toBe(true);
  });

  it("infers the verdict from the score when none is provided", () => {
    expect(verdictSummary({ riskScore: 85 }).label).toBe("Blocked");
    expect(verdictSummary({ riskScore: 55 }).label).toBe("Suspicious");
    expect(verdictSummary({ riskScore: 5 }).label).toBe("Safe");
  });
});

describe("complianceMapping", () => {
  it("maps known detectors to OWASP + ATLAS", () => {
    expect(complianceMapping("system_prompt_leak").owasp).toContain("LLM07");
    expect(complianceMapping("goal_drift").owasp).toContain("LLM08");
  });

  it("falls back to prompt injection for unknown / missing keys", () => {
    expect(complianceMapping(null).owasp).toContain("LLM01");
    expect(complianceMapping("something_new").owasp).toContain("LLM01");
  });
});
