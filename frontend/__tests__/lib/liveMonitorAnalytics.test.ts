import { describe, it, expect } from "vitest";
import { buildMonitorAnalytics } from "@/lib/liveMonitorAnalytics";
import { roundToTranscriptTurn, score01 } from "@/lib/campaignTranscript";

describe("score01", () => {
  it("normalizes 0–10 backend scores to 0–1", () => {
    expect(score01(10)).toBe(1);
    expect(score01(5)).toBe(0.5);
    expect(score01(0.7)).toBe(0.7);
  });
});

describe("buildMonitorAnalytics", () => {
  it("aggregates real round telemetry including guardrail layers", () => {
    const turns = [
      roundToTranscriptTurn({
        round_number: 1,
        duration_ms: 1000,
        timestamp: "2026-08-26T13:29:17Z",
        attack: { category: "DPI", name: "inj", prompt: "x", metadata: { mitre_atlas: "AML.T0051" } },
        response: {
          response: "ok",
          blocked: true,
          blocked_by: "INPUT_FILTER",
          latency_ms: 400,
          guardrail_trace: [
            { layer: "INPUT_FILTER", passed: false, details: "hit", latency_ms: 1.2 },
            { layer: "LLM_GENERATION", passed: true, details: "ok", latency_ms: 0 },
          ],
        },
        score: {
          verdict: "BLOCKED",
          attack_success_score: 0,
          defense_quality_score: 10,
          bypass_depth: 1,
          information_leakage_score: 0,
          severity: "LOW",
        },
      }),
      roundToTranscriptTurn({
        round_number: 2,
        duration_ms: 800,
        attack: { category: "SPE", name: "exfil", prompt: "y" },
        response: {
          response: "leak",
          blocked: false,
          latency_ms: 900,
          guardrail_trace: [
            { layer: "INPUT_FILTER", passed: true, details: "ok", latency_ms: 0.5 },
          ],
        },
        score: {
          verdict: "SUCCESS",
          attack_success_score: 8,
          defense_quality_score: 2,
          bypass_depth: 3,
          information_leakage_score: 7,
          severity: "CRITICAL",
        },
      }),
    ];

    const a = buildMonitorAnalytics(turns);
    expect(a.kpis.n).toBe(2);
    expect(a.series).toHaveLength(2);
    expect(a.series[0].attackPct).toBe(0);
    expect(a.series[1].attackPct).toBe(80);
    expect(a.layers.some((l) => l.layer === "INPUT_FILTER" && l.failed === 1)).toBe(true);
    expect(a.categories.map((c) => c.category).sort()).toEqual(["DPI", "SPE"]);
    expect(a.kpis.blockRate).toBe(50);
    expect(turns[0].guardrailTrace).toHaveLength(2);
    expect(turns[0].mitreAtlas).toBe("AML.T0051");
  });
});
