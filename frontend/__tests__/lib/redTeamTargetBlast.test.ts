import { describe, expect, it } from "vitest";
import { buildTargetBlastGraph, matchCampaignsForTarget } from "@/lib/redTeamTargetBlast";
import type { CampaignListItem } from "@/lib/hooks/useCampaigns";

const campaigns: CampaignListItem[] = [
  {
    id: "c1",
    name: "DPI run",
    status: "COMPLETED",
    provider: "openai",
    model: "gpt-4o",
    rounds_completed: 5,
    total_rounds: 5,
    summary: { results_by_verdict: { ATTACK_SUCCESS: 2, BLOCKED: 3 } },
  },
  {
    id: "c2",
    name: "Other",
    status: "COMPLETED",
    provider: "anthropic",
    model: "claude",
    rounds_completed: 3,
    total_rounds: 3,
    summary: null,
  },
];

describe("redTeamTargetBlast", () => {
  it("matches campaigns to a target provider", () => {
    const spokes = matchCampaignsForTarget({ id: "openai", name: "OpenAI" }, campaigns);
    expect(spokes).toHaveLength(1);
    expect(spokes[0]?.campaignId).toBe("c1");
    expect(spokes[0]?.riskScore).toBe(40);
  });

  it("builds blast nodes for each target", () => {
    const graph = buildTargetBlastGraph(
      [
        { id: "openai", name: "OpenAI", model: "gpt-4o", configured: true },
        { id: "anthropic", name: "Anthropic", model: "claude", configured: true },
      ],
      campaigns
    );
    expect(graph).toHaveLength(2);
    expect(graph[0]?.spokes).toHaveLength(1);
    expect(graph[1]?.spokes).toHaveLength(1);
  });
});
