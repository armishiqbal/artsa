import { describe, it, expect } from "vitest";
import { deriveFindings } from "@/lib/findings";
import { buildDetectionSeries, detectionSeriesToCsv } from "@/lib/detectionAnalytics";

describe("findings", () => {
  it("derives campaign findings with validated status", () => {
    const rows = deriveFindings([], [
      {
        id: "c1",
        name: "Test run",
        status: "COMPLETED",
        provider: "groq",
        model: "m",
        rounds_completed: 1,
        total_rounds: 1,
        summary: {
          top_findings: [
            {
              round_number: 1,
              attack: { prompt: "x", name: "Inject", category: "PROMPT_INJECTION" },
              response: { response: "blocked" },
              score: { verdict: "BLOCKED", severity: "HIGH", attack_success_score: 1 },
            },
          ],
        },
      },
    ]);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].status).toBe("validated");
  });
});

describe("detectionAnalytics", () => {
  it("builds ARTSA vs baseline series from risk trend", () => {
    const series = buildDetectionSeries(
      [
        { timestamp: "2026-01-01T00:00:00Z", risk_score: 20 },
        { timestamp: "2026-01-01T01:00:00Z", risk_score: 40 },
      ],
      80
    );
    expect(series[0].artsaRate).toBe(80);
    expect(series[0].baselineRate).toBe(62);
  });

  it("exports CSV rows", () => {
    const csv = detectionSeriesToCsv([
      { index: 1, label: "a", artsaRate: 75.5, baselineRate: 62 },
    ]);
    expect(csv).toContain("artsa_detection_rate");
    expect(csv).toContain("75.5");
  });
});
