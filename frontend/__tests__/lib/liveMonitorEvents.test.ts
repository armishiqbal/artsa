import { describe, it, expect } from "vitest";
import {
  detectionRateFromEvents,
  eventsFromRounds,
  verdictToOutcome,
  type LiveMonitorEvent,
} from "@/lib/liveMonitorEvents";

describe("liveMonitorEvents", () => {
  it("maps verdicts to pass/fail/flag", () => {
    expect(verdictToOutcome("BLOCKED")).toBe("pass");
    expect(verdictToOutcome("SUCCESS")).toBe("fail");
    expect(verdictToOutcome("PARTIAL")).toBe("flag");
  });

  it("builds a 3-line feed per round", () => {
    const events = eventsFromRounds("c1", [
      {
        round_number: 1,
        timestamp: "2026-08-26T13:00:00Z",
        attack: { name: "DPI probe", category: "DPI" },
        response: { response: "nope", blocked: true },
        score: { verdict: "BLOCKED" },
      },
    ]);
    expect(events).toHaveLength(3);
    expect(events.map((e) => e.kind)).toEqual(["attack", "response", "verdict"]);
    expect(events[2].outcome).toBe("pass");
  });

  it("computes running detection rate sparkline", () => {
    const base: Omit<LiveMonitorEvent, "outcome" | "seq" | "summary" | "kind"> = {
      type: "campaign_live",
      campaign_id: "c1",
      ts: "2026-08-26T13:00:00Z",
      actor: "judge",
      round: 1,
      attack_type: "DPI",
    };
    const events: LiveMonitorEvent[] = [
      { ...base, seq: 1, kind: "verdict", outcome: "pass", summary: "pass" },
      { ...base, seq: 2, kind: "verdict", outcome: "fail", summary: "fail", round: 2 },
      { ...base, seq: 3, kind: "verdict", outcome: "pass", summary: "pass", round: 3 },
    ];
    const d = detectionRateFromEvents(events);
    expect(d.judged).toBe(3);
    expect(d.passed).toBe(2);
    expect(d.rate).toBeCloseTo(66.7, 0);
    expect(d.spark).toEqual([100, 50, 66.7]);
  });
});
