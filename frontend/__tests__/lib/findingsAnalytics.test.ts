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
  it("uses judged campaign outcomes instead of converting risk scores", () => {
    const series = buildDetectionSeries({ detection_rate: 75, judged: 4 });
    expect(series[0]?.detectionRate).toBe(75);
    expect(series[0]?.judged).toBe(4);
  });

  it("exports CSV rows", () => {
    const csv = detectionSeriesToCsv([
      { index: 1, label: "a", detectionRate: 75.5, judged: 4 },
    ]);
    expect(csv).toContain("detection_rate_percent");
    expect(csv).toContain("75.5");
  });
});
