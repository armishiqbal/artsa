import { describe, expect, it } from "vitest";
import {
  DEMO_REPLAY_SESSIONS,
  DEMO_REPLAY_TIMELINES,
  getDemoSession,
  getDemoTimeline,
} from "@/lib/replayDemoData";

describe("replayDemoData", () => {
  it("exports 3 pre-flight demonstration sessions", () => {
    expect(DEMO_REPLAY_SESSIONS.length).toBe(3);
    for (const s of DEMO_REPLAY_SESSIONS) {
      expect(s.id).toBeTruthy();
      expect(s.agent_id).toBeTruthy();
      expect(s.tenant_id).toBeTruthy();
      expect(["BREACHED", "QUARANTINED", "ACTIVE"]).toContain(s.status);
      expect(typeof s.max_risk_score).toBe("number");
    }
  });

  it("provides complete multi-hop timeline for sess-cyberstorm-01 with breach and containment", () => {
    const timeline = getDemoTimeline("sess-cyberstorm-01");
    expect(timeline.length).toBe(5);

    const breachHop = timeline.find((t) => t.evaluation?.verdict === "BREACHED");
    expect(breachHop).toBeDefined();
    expect(breachHop?.event.tool_name).toBe("exec_system_shell");
    expect(breachHop?.evaluation?.risk_score).toBe(94);

    const containmentHop = timeline.find((t) => t.evaluation?.verdict === "CONTAINED");
    expect(containmentHop).toBeDefined();
    expect(containmentHop?.event.tool_name).toBe("containment_circuit_breaker");
  });

  it("retrieves session by id correctly", () => {
    const s1 = getDemoSession("sess-cyberstorm-01");
    expect(s1).toBeDefined();
    expect(s1?.agent_id).toBe("autonomous-rag-copilot-prod");

    const missing = getDemoSession("non-existent");
    expect(missing).toBeUndefined();
  });

  it("verifies chronological order of timeline events", () => {
    for (const [sessionId, timeline] of Object.entries(DEMO_REPLAY_TIMELINES)) {
      for (let i = 1; i < timeline.length; i++) {
        const prev = new Date(timeline[i - 1].event.timestamp).getTime();
        const curr = new Date(timeline[i].event.timestamp).getTime();
        expect(curr).toBeGreaterThanOrEqual(prev);
      }
    }
  });
});
