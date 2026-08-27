import { buildCampaignAttackViz } from "@/lib/campaignAttackViz";
import type { LiveMonitorEvent } from "@/lib/liveMonitorEvents";

function evt(
  partial: Partial<LiveMonitorEvent> & Pick<LiveMonitorEvent, "seq" | "kind" | "summary">
): LiveMonitorEvent {
  return {
    type: "campaign_live",
    campaign_id: "c1",
    ts: "2026-08-27T12:00:00Z",
    outcome: null,
    actor: "red_team",
    round: 1,
    attack_type: "DPI: probe",
    ...partial,
  };
}

describe("buildCampaignAttackViz", () => {
  it("stays idle with no events", () => {
    const m = buildCampaignAttackViz([]);
    expect(m.idle).toBe(true);
    expect(m.rounds).toEqual([]);
    expect(m.path.every((n) => !n.active || n.detail === "idle" || n.detail === "—")).toBe(true);
  });

  it("lights the attack path across a round", () => {
    const m = buildCampaignAttackViz([
      evt({
        seq: 1,
        kind: "attack",
        summary: "Red Team → Target: DPI: jailbreak",
        attack_type: "DPI: jailbreak",
        round: 1,
        actor: "red_team",
      }),
      evt({
        seq: 2,
        kind: "response",
        summary: "Target → I cannot help with that",
        round: 1,
        actor: "target",
      }),
      evt({
        seq: 3,
        kind: "verdict",
        summary: "Judge → BLOCKED (PASS)",
        outcome: "pass",
        round: 1,
        actor: "judge",
      }),
    ]);
    expect(m.idle).toBe(false);
    expect(m.rounds).toHaveLength(1);
    expect(m.rounds[0]?.outcome).toBe("pass");
    expect(m.outcomeCounts.pass).toBe(1);
    expect(m.path[0]?.active).toBe(true);
    expect(m.path[3]?.detail).toBe("BLOCKED");
    expect(m.hopSeries).toHaveLength(1);
  });
});
