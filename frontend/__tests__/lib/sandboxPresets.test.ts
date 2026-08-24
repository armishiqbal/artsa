import { describe, it, expect } from "vitest";
import { presetByCaseId, SANDBOX_PRESETS, sandboxHrefForCase } from "@/lib/sandboxPresets";
import { VALIDATION_CASES } from "@/lib/getStarted";
import { wargameAppendixForReport } from "@/lib/campaignReadiness";

describe("sandboxPresets", () => {
  it("maps every attack case to a preset", () => {
    const attackIds = VALIDATION_CASES.filter((c) => c.category !== "safe").map((c) => c.id);
    for (const id of attackIds) {
      expect(presetByCaseId(id)).toBeDefined();
    }
    expect(SANDBOX_PRESETS.length).toBeGreaterThanOrEqual(7);
  });

  it("builds sandbox deep links", () => {
    const href = sandboxHrefForCase(VALIDATION_CASES[0]);
    expect(href).toContain("case=");
  });
});

describe("campaignReadiness", () => {
  it("formats wargame appendix rows", () => {
    const rows = wargameAppendixForReport([
      {
        campaign_id: "c1",
        completed_at: "2026-01-01T00:00:00Z",
        summary: { completed_rounds: 3, avg_defense_quality: 0.9 },
      },
    ]);
    expect(rows[0].campaign_id).toBe("c1");
    expect(rows[0].completed_rounds).toBe(3);
  });
});
