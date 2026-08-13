import { describe, it, expect } from "vitest";

describe("navigation", () => {
  it("exports all primary routes", async () => {
    const { navSections } = await import("@/lib/navigation");
    const hrefs = navSections.flatMap((s) => s.items.map((i) => i.href));
    expect(hrefs).toContain("/dashboard");
    expect(hrefs).toContain("/campaigns");
    expect(hrefs).toContain("/admin/policies");
    expect(hrefs).toContain("/replay");
  });
});

describe("risk score formatting", () => {
  it("formats scores consistently", async () => {
    const { formatRiskScore } = await import("@/lib/utils");
    expect(formatRiskScore(92.4)).toBe("92.4");
  });
});
