import { describe, it, expect } from "vitest";
import { buildProbeLoadout, deriveTargetPosture } from "@/lib/redTeamEngagement";
import type { CampaignListItem } from "@/lib/hooks/useCampaigns";

describe("redTeamEngagement", () => {
  it("builds weighted probe loadout", () => {
    const loadout = buildProbeLoadout(
      ["DPI", "JBK"],
      { DPI: 40, JBK: 35 },
      { DPI: "Prompt injection", JBK: "Jailbreak" }
    );
    expect(loadout).toHaveLength(2);
    expect(loadout[0]).toMatchObject({ code: "DPI", weight: 40 });
  });

  it("derives target posture from history", () => {
    const campaigns: CampaignListItem[] = [
      {
        id: "1",
        name: "a",
        status: "COMPLETED",
        provider: "deepseek",
        model: "deepseek-chat",
        rounds_completed: 5,
        total_rounds: 5,
        summary: { avg_attack_success: 7.2 },
      },
      {
        id: "2",
        name: "b",
        status: "COMPLETED",
        provider: "deepseek",
        model: "deepseek-chat",
        rounds_completed: 3,
        total_rounds: 5,
        summary: { avg_attack_success: 2.0 },
      },
    ];
    const posture = deriveTargetPosture(campaigns, "deepseek");
    expect(posture.scanCount).toBe(2);
    expect(posture.pressure).toBe("medium");
    expect(posture.avgAttack).toBeCloseTo(4.6, 1);
  });

  it("returns unset posture without provider", () => {
    expect(deriveTargetPosture([], null).pressure).toBe("unset");
  });
});
