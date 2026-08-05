import { describe, it, expect } from "vitest";
import {
  severityFromScore,
  riskScoreBadgeVariant,
  CRITICAL_RISK_THRESHOLD,
  HIGH_RISK_THRESHOLD,
  MEDIUM_RISK_THRESHOLD,
} from "@/lib/severity";

describe("severity thresholds", () => {
  it("maps scores to bands at 80 / 50 / 40", () => {
    expect(severityFromScore(CRITICAL_RISK_THRESHOLD)).toBe("CRITICAL");
    expect(severityFromScore(CRITICAL_RISK_THRESHOLD - 1)).toBe("HIGH");
    expect(severityFromScore(HIGH_RISK_THRESHOLD)).toBe("HIGH");
    expect(severityFromScore(HIGH_RISK_THRESHOLD - 1)).toBe("MEDIUM");
    expect(severityFromScore(MEDIUM_RISK_THRESHOLD)).toBe("MEDIUM");
    expect(severityFromScore(MEDIUM_RISK_THRESHOLD - 1)).toBe("LOW");
  });

  it("maps badge variants consistently with severity bands", () => {
    expect(riskScoreBadgeVariant(92)).toBe("critical");
    expect(riskScoreBadgeVariant(55)).toBe("warning");
    expect(riskScoreBadgeVariant(45)).toBe("secondary");
    expect(riskScoreBadgeVariant(12)).toBe("success");
  });
});
