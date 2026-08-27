import { describe, expect, it } from "vitest";
import { deriveRedTeamServiceReady } from "@/lib/redTeamServiceReady";

describe("deriveRedTeamServiceReady", () => {
  it("blocks run when service is offline", () => {
    const m = deriveRedTeamServiceReady({
      apiOnline: false,
      providerCount: 1,
      liveEventCount: 5,
      campaignCount: 1,
    });
    expect(m.canRun).toBe(false);
    expect(m.shareReady).toBe(false);
    expect(m.checks.find((c) => c.id === "service")?.ok).toBe(false);
  });

  it("is run-ready with service + provider but not share-ready without traffic", () => {
    const m = deriveRedTeamServiceReady({
      apiOnline: true,
      providerCount: 1,
      liveEventCount: 0,
      campaignCount: 0,
    });
    expect(m.canRun).toBe(true);
    expect(m.shareReady).toBe(false);
  });

  it("is share-ready when traffic or campaigns exist", () => {
    const m = deriveRedTeamServiceReady({
      apiOnline: true,
      providerCount: 2,
      liveEventCount: 3,
      campaignCount: 0,
    });
    expect(m.shareReady).toBe(true);
    expect(m.readyCount).toBe(3);
  });
});
