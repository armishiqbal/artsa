import {
  buildLiveAiActivity,
  ingestDetectionStats,
  liveIngestStreamNewestFirst,
  telemetryToLiveMonitorEvents,
} from "@/lib/redTeamLiveIngest";

describe("redTeamLiveIngest", () => {
  const sample = [
    {
      agent_id: "harness",
      tool_name: "user_prompt",
      risk_score: 95,
      verdict: "BREACHED",
      severity: "CRITICAL",
      timestamp: "2026-08-27T10:00:02Z",
    },
    {
      agent_id: "harness",
      tool_name: "user_prompt",
      risk_score: 0,
      verdict: "SAFE",
      severity: "LOW",
      timestamp: "2026-08-27T10:00:01Z",
    },
  ];

  it("maps telemetry to live monitor events", () => {
    const mapped = telemetryToLiveMonitorEvents(sample);
    expect(mapped).toHaveLength(2);
    expect(mapped[0]?.outcome).toBe("pass");
    expect(mapped[1]?.outcome).toBe("fail");
  });

  it("newest-first stream puts breach first when input is newest-first", () => {
    const stream = liveIngestStreamNewestFirst(sample);
    expect(stream[0]?.outcome).toBe("fail");
    expect(stream[0]?.summary).toContain("BREACHED");
  });

  it("computes detect rate from elevated verdicts", () => {
    const stats = ingestDetectionStats(sample);
    expect(stats.total).toBe(2);
    expect(stats.fails).toBe(1);
    expect(stats.detectPct).toBe(50);
  });

  it("builds AI activity visualization model", () => {
    const model = buildLiveAiActivity([
      {
        agent_id: "harness",
        tool_name: "user_prompt",
        risk_score: 95,
        verdict: "BREACHED",
        detectors: ["PromptInjectionDetector", "GoalDriftDetector"],
        timestamp: "2026-08-27T10:00:02Z",
      },
      {
        agent_id: "harness",
        tool_name: "user_prompt",
        risk_score: 10,
        verdict: "SAFE",
        timestamp: "2026-08-27T10:00:01Z",
      },
    ]);
    expect(model.pipeline).toHaveLength(5);
    expect(model.tools[0]?.tool).toBe("user_prompt");
    expect(model.detectors.some((d) => d.name.includes("PromptInjection"))).toBe(true);
    expect(model.riskSeries.length).toBeGreaterThanOrEqual(2);
  });
});
