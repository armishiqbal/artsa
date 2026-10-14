import { describe, it, expect } from "vitest";
import { deriveEnterpriseAnalytics, analyticsBundleToCsv } from "@/lib/enterpriseAnalytics";
import { buildDetectionSeries } from "@/lib/detectionAnalytics";

describe("enterpriseAnalytics", () => {
  it("derives severity, actions, ranks from live events", () => {
    const analytics = deriveEnterpriseAnalytics(
      {
        severity_counts: { CRITICAL: 1, HIGH: 2, MEDIUM: 0, LOW: 3 },
        defense_score: 77,
        defense_layers: { tool_validator: 90 },
        risk_trend: [
          { timestamp: "2026-01-01T00:00:00Z", risk_score: 20 },
          { timestamp: "2026-01-01T01:00:00Z", risk_score: 85 },
        ],
      },
      [
        {
          agent_id: "scout",
          tool_name: "query_db",
          risk_score: 88,
          verdict: "BREACHED",
          action: "KILL",
          enforced: true,
          triggered_at: "2026-01-01T01:00:00Z",
        },
        {
          agent_id: "writer",
          tool_name: "write_file",
          risk_score: 40,
          verdict: "SAFE",
          action: "ALLOW",
          enforced: false,
          triggered_at: "2026-01-01T01:05:00Z",
        },
        {
          agent_id: "scout",
          tool_name: "query_db",
          risk_score: 55,
          verdict: "SUSPICIOUS",
          action: "QUARANTINE",
          enforced: true,
          triggered_at: "2026-01-01T01:10:00Z",
        },
      ]
    );

    expect(analytics.hasLiveSignal).toBe(true);
    expect(analytics.riskTrend).toHaveLength(2);
    expect(analytics.topTools[0]?.name).toBe("query_db");
    expect(analytics.actionSlices.some((a) => a.key === "KILL")).toBe(true);
    expect(analytics.containedCount).toBe(2);
    expect(analytics.containmentRate).toBe(67);
    expect(analyticsBundleToCsv(analytics)).toContain("kpi,containment_rate");
  });

  it("stays empty without fabricating series", () => {
    const analytics = deriveEnterpriseAnalytics(null, []);
    expect(analytics.hasLiveSignal).toBe(false);
    expect(analytics.riskTrend).toHaveLength(0);
    expect(analytics.topTools).toHaveLength(0);
    expect(analytics.avgRisk).toBeNull();
    expect(analytics.maxRisk).toBeNull();
    expect(analytics.defenseScore).toBeNull();
    expect(analytics.containmentRate).toBeNull();
  });

  it("does not infer enforcement or severity from verdict text alone", () => {
    const analytics = deriveEnterpriseAnalytics(null, [
      { verdict: "BREACHED", tool_name: "dangerous_tool" },
      { verdict: "SUSPICIOUS", agent_id: "agent-a" },
    ]);
    expect(analytics.containmentRate).toBeNull();
    expect(analytics.containedCount).toBeNull();
    expect(analytics.hasSeveritySignal).toBe(false);
    expect(analytics.riskTrend).toHaveLength(0);
    expect(analytics.topTools).toHaveLength(0);
  });
});

describe("detectionAnalytics live-only", () => {
  it("requires a judged campaign detection-rate metric", () => {
    expect(buildDetectionSeries(undefined)).toHaveLength(0);
    expect(buildDetectionSeries({ detection_rate: 80, judged: 0 })).toHaveLength(0);
    expect(buildDetectionSeries({ detection_rate: 80, judged: 4 })).toEqual([
      { index: 1, label: "Completed campaign outcomes", detectionRate: 80, judged: 4 },
    ]);
  });
});
