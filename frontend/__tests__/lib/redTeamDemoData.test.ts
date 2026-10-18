import { describe, it, expect } from "vitest";
import {
  CREW_SIX_AGENTS,
  DEMO_REDTEAM_CAMPAIGNS,
  DEMO_CAMPAIGN_ROUND_EVENTS,
  getDemoCampaign,
  getDemoCampaignEvents,
} from "@/lib/redTeamDemoData";

describe("redTeamDemoData", () => {
  it("defines the canonical Six-Agent chain with complete CrewAI specifications", () => {
    expect(CREW_SIX_AGENTS).toHaveLength(6);

    const expectedIds = ["research", "curator", "red_team", "target", "judge", "defender"];
    expect(CREW_SIX_AGENTS.map((a) => a.id)).toEqual(expectedIds);

    for (const agent of CREW_SIX_AGENTS) {
      expect(agent.name).toBeTruthy();
      expect(agent.role).toBeTruthy();
      expect(agent.goal).toBeTruthy();
      expect(agent.backstory).toBeTruthy();
      expect(agent.tools.length).toBeGreaterThan(0);
      expect(agent.contextInput).toBeTruthy();
      expect(agent.contextOutput).toBeTruthy();
      expect(agent.hmacVerified).toBe(true);
    }
  });

  it("exports 3 pre-flight demonstration campaigns with valid ASI categories", () => {
    expect(DEMO_REDTEAM_CAMPAIGNS).toHaveLength(3);

    const categories = DEMO_REDTEAM_CAMPAIGNS.map(
      (c) => (c.summary as Record<string, unknown>)?.asi_category
    );
    expect(categories).toContain("ASI01");
    expect(categories).toContain("ASI02");
    expect(categories).toContain("ASI04");

    for (const campaign of DEMO_REDTEAM_CAMPAIGNS) {
      expect(campaign.rounds_completed).toBeGreaterThan(0);
      expect(campaign.rounds_completed).toBe(campaign.total_rounds);
      expect(campaign.status).toBe("COMPLETED");
    }
  });

  it("retrieves campaigns and round event streams by ID", () => {
    const camp = getDemoCampaign("camp-demo-01");
    expect(camp).toBeDefined();
    expect(camp?.name).toContain("Direct Prompt Extraction");

    const nonExistent = getDemoCampaign("non-existent");
    expect(nonExistent).toBeUndefined();

    const events = getDemoCampaignEvents("camp-demo-01");
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].actor).toBe("research");
  });

  it("verifies chronological order and sequence numbers of campaign events", () => {
    for (const events of Object.values(DEMO_CAMPAIGN_ROUND_EVENTS)) {
      for (let i = 1; i < events.length; i++) {
        expect(events[i].seq).toBeGreaterThan(events[i - 1].seq);
        const prevTime = new Date(events[i - 1].ts).getTime();
        const currTime = new Date(events[i].ts).getTime();
        expect(currTime).toBeGreaterThanOrEqual(prevTime);
      }
    }
  });
});
