import { describe, it, expect } from "vitest";
import { PIPELINE_AGENTS, PIPELINE_AGENT_BY_ID, agentRoleClass } from "@/lib/agentRoles";
import { derivePipelineSnapshot } from "@/lib/pipelineState";
import { deriveCommandCenterKpis } from "@/lib/commandCenterKpis";

describe("agentRoles", () => {
  it("defines six agents in closed-loop order", () => {
    expect(PIPELINE_AGENTS).toHaveLength(6);
    expect(PIPELINE_AGENT_BY_ID.defender.next).toBe("research");
  });

  it("maps each role to a stable CSS class", () => {
    for (const agent of PIPELINE_AGENTS) {
      expect(agentRoleClass(agent.id)).toBe(`agent-role-${agent.id}`);
    }
  });
});

describe("derivePipelineSnapshot", () => {
  it("marks agents offline when API is down", () => {
    const snap = derivePipelineSnapshot({
      apiOnline: false,
      wsConnected: false,
      activeSessions: 0,
      defenseScore: 0,
      criticalCount: 0,
      highCount: 0,
      campaigns: [],
      playbookRuleCount: 0,
    });
    expect(snap.agents.every((a) => a.status === "offline")).toBe(true);
  });

  it("activates target when sessions are live", () => {
    const snap = derivePipelineSnapshot({
      apiOnline: true,
      wsConnected: true,
      activeSessions: 2,
      defenseScore: 80,
      criticalCount: 0,
      highCount: 0,
      campaigns: [],
      playbookRuleCount: 3,
    });
    const target = snap.agents.find((a) => a.id === "target");
    expect(target?.status).toBe("active");
    expect(snap.activeAgentId).toBe("target");
  });
});

describe("deriveCommandCenterKpis", () => {
  it("builds playbook version label from server version", () => {
    const kpis = deriveCommandCenterKpis(
      { severity_counts: { CRITICAL: 1, HIGH: 2, MEDIUM: 0, LOW: 0 }, defense_score: 75 },
      [],
      5,
      []
    );
    expect(kpis.playbookVersion).toBe("v5");
    expect(kpis.pendingTriage).toBe(3);
  });
});
