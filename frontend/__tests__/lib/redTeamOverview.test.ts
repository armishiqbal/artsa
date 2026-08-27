import { deriveRedTeamOverview } from "@/lib/redTeamOverview";

describe("deriveRedTeamOverview charts", () => {
  it("returns empty chart series without inventing data", () => {
    const o = deriveRedTeamOverview([]);
    expect(o.outcomeChart).toEqual([]);
    expect(o.statusMix).toEqual([]);
    expect(o.campaignRisk).toEqual([]);
    expect(o.posture).toBe("unknown");
    expect(o.hasFindingData).toBe(false);
    expect(o.coverageChart).toHaveLength(6);
    expect(o.coverageChart.every((r) => r.tested === 0)).toBe(true);
  });

  it("builds outcome and status charts from campaigns", () => {
    const o = deriveRedTeamOverview([
      {
        id: "c1",
        name: "Injection sweep",
        status: "COMPLETED",
        provider: "ollama",
        model: "llama",
        rounds_completed: 3,
        total_rounds: 3,
        summary: {
          top_findings: [
            {
              round_number: 1,
              attack: { name: "Ignore instructions jailbreak", category: "PROMPT_INJECTION" },
              response: { response: "ok", blocked: false },
              score: {
                verdict: "SUCCESS",
                severity: "CRITICAL",
                attack_success_score: 0.9,
              },
            },
            {
              round_number: 2,
              attack: { name: "Benign probe", category: "PROMPT_INJECTION" },
              response: { response: "refused", blocked: true },
              score: {
                verdict: "BLOCKED",
                severity: "LOW",
                attack_success_score: 0.1,
              },
            },
          ],
        },
      },
      {
        id: "c2",
        name: "Live run",
        status: "RUNNING",
        provider: "ollama",
        model: "llama",
        rounds_completed: 1,
        total_rounds: 5,
        summary: null,
      },
    ]);

    expect(o.successes).toBeGreaterThanOrEqual(1);
    expect(o.blocked).toBeGreaterThanOrEqual(1);
    expect(o.outcomeChart.some((d) => d.name === "Breached")).toBe(true);
    expect(o.statusMix.some((d) => d.name === "Running")).toBe(true);
    expect(o.campaignRisk.length).toBe(2);
    expect(o.campaignRisk.some((r) => r.status === "RUNNING")).toBe(true);
    expect(o.hasFindingData).toBe(true);
  });

  it("lists every campaign in risk table (no silent top-8 cut)", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      id: `c${i}`,
      name: `Campaign ${i}`,
      status: i % 3 === 0 ? "FAILED" : "COMPLETED",
      provider: "ollama",
      model: "llama",
      rounds_completed: i,
      total_rounds: 10,
      summary: null,
      error: i % 3 === 0 ? "provider error" : null,
    }));
    const o = deriveRedTeamOverview(many);
    expect(o.campaignRisk).toHaveLength(12);
  });
});
