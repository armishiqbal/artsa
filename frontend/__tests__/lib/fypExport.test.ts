import { buildFypMarkdown, findingsToExportRows } from "@/lib/fypExport";

describe("fypExport", () => {
  it("builds markdown with executive summary", () => {
    const md = buildFypMarkdown({
      generatedAt: "2026-08-22T00:00:00Z",
      playbookVersion: 2,
      findingsCount: 1,
      campaignsCount: 1,
      defenseScore: 88,
      threatsBlocked: 5,
      findings: [{ title: "Test", severity: "HIGH", asi: "ASI01", status: "validated" }],
    });
    expect(md).toContain("Playbook version: **v2**");
    expect(md).toContain("| Test | HIGH | ASI01 | validated |");
  });

  it("maps findings to export rows", () => {
    const rows = findingsToExportRows([
      {
        id: "x",
        title: "A",
        severity: "HIGH",
        category: "DPI",
        asi_code: "ASI01",
        asi_label: "Hijack",
        status: "new",
        source: "campaign",
        timestamp: null,
      },
    ]);
    expect(rows[0].asi).toBe("ASI01");
  });
});
