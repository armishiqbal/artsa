import { describe, expect, it } from "vitest";
import {
  campaignMatchesTechnique,
  deriveExperimentLog,
  parseLabCampaignName,
} from "@/lib/labExperimentLog";
import { filterEventsByWindow } from "@/lib/redTeamLiveIngest";
import { rowsToCsv } from "@/lib/redTeamExport";

describe("parseLabCampaignName", () => {
  it("parses Lab · technique · strategy", () => {
    const p = parseLabCampaignName("Lab · Prompt Injection · Direct");
    expect(p.isLab).toBe(true);
    expect(p.technique).toBe("Prompt Injection");
    expect(p.strategy).toBe("Direct");
  });

  it("rejects non-lab names", () => {
    expect(parseLabCampaignName("Weekly baseline").isLab).toBe(false);
  });
});

describe("campaignMatchesTechnique", () => {
  it("matches by name prefix and registry", () => {
    expect(
      campaignMatchesTechnique(
        { id: "a", name: "Lab · Tool Abuse · Obfuscated" },
        "Tool Abuse",
        []
      )
    ).toBe(true);
    expect(
      campaignMatchesTechnique(
        { id: "b", name: "Custom run" },
        "Tool Abuse",
        [
          {
            campaignId: "b",
            technique: "Tool Abuse",
            strategy: "Direct",
            intensity: 60,
            iterations: 8,
            mutation: true,
            categories: [],
            startedAt: "2026-01-01T00:00:00.000Z",
          },
        ]
      )
    ).toBe(true);
  });
});

describe("deriveExperimentLog", () => {
  it("includes Lab · named campaigns", () => {
    const rows = deriveExperimentLog(
      [
        {
          id: "1",
          name: "Lab · Exfiltration · Direct",
          status: "COMPLETED",
          rounds_completed: 4,
          total_rounds: 4,
          summary: null,
        },
      ],
      () => 72
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.technique).toBe("Exfiltration");
    expect(rows[0]!.risk).toBe(72);
  });
});

describe("filterEventsByWindow", () => {
  const now = Date.parse("2026-08-27T12:00:00.000Z");

  it("keeps all when window is all", () => {
    const events = [{ timestamp: "2026-08-27T11:00:00.000Z", session_id: "s1" }];
    expect(filterEventsByWindow(events, "all", now)).toHaveLength(1);
  });

  it("filters by 15m age", () => {
    const events = [
      { timestamp: "2026-08-27T11:55:00.000Z", session_id: "s1" },
      { timestamp: "2026-08-27T11:00:00.000Z", session_id: "s1" },
    ];
    expect(filterEventsByWindow(events, "15m", now)).toHaveLength(1);
  });

  it("filters to latest session", () => {
    const events = [
      { timestamp: "2026-08-27T11:59:00.000Z", session_id: "s-new" },
      { timestamp: "2026-08-27T11:58:00.000Z", session_id: "s-old" },
      { timestamp: "2026-08-27T11:57:00.000Z", session_id: "s-new" },
    ];
    const out = filterEventsByWindow(events, "session", now);
    expect(out).toHaveLength(2);
    expect(out.every((e) => e.session_id === "s-new")).toBe(true);
  });
});

describe("rowsToCsv", () => {
  it("escapes commas and quotes", () => {
    const csv = rowsToCsv(["a", "b"], [["x,y", 'say "hi"']]);
    expect(csv).toBe('a,b\n"x,y","say ""hi"""');
  });
});
