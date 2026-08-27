import {
  categoriesFromTechnique,
  intensityFromMatrix,
  mergeCampaignCategories,
  mutationsForIntensity,
} from "@/lib/redTeamAttackSets";

describe("redTeamAttackSets", () => {
  it("maps attack sets and matrix into category codes", () => {
    const cats = mergeCampaignCategories(
      ["Prompt Injection", "Tool Abuse"],
      {
        Injection: { Low: true, Med: false, High: false },
        Exfiltration: { Low: false, Med: true, High: false },
        "Tool Abuse": { Low: false, Med: false, High: false },
        "Goal Drift": { Low: false, Med: false, High: false },
      }
    );
    expect(cats).toEqual(expect.arrayContaining(["DPI", "JBK", "PEX", "DEX", "SPE"]));
  });

  it("picks highest intensity from matrix", () => {
    expect(
      intensityFromMatrix({
        Injection: { Low: true, Med: true, High: false },
      })
    ).toBe("Med");
    expect(
      intensityFromMatrix({
        Injection: { Low: true, Med: false, High: true },
      })
    ).toBe("High");
  });

  it("maps intensity to mutations", () => {
    expect(mutationsForIntensity("Low")).toEqual({
      mutations_enabled: false,
      max_mutations_per_attack: 0,
    });
    expect(mutationsForIntensity("High").max_mutations_per_attack).toBe(3);
  });

  it("maps lab techniques", () => {
    expect(categoriesFromTechnique("Memory Attack")).toEqual(["IPI"]);
    expect(categoriesFromTechnique("Unknown")).toEqual(["DPI", "JBK"]);
  });
});
