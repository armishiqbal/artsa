import { describe, it, expect, vi } from "vitest";
import {
  computeReadinessFlow,
  computeReadinessFromMilestones,
  isSuiteComplete,
  readinessScoreFromFlow,
} from "@/lib/readinessFlow";

describe("readinessFlow", () => {
  const base = {
    apiOnline: true,
    wsConnected: true,
    suitePass: 0,
    suiteTotal: 8,
    casesRun: 0,
    ingestDone: false,
    trafficConfirmed: false,
  };

  it("starts in validate phase", () => {
    const state = computeReadinessFlow(base);
    expect(state.phase).toBe("validate");
    expect(state.suiteComplete).toBe(false);
    expect(state.blockers.length).toBeGreaterThan(0);
  });

  it("advances to ingest after suite complete", () => {
    const state = computeReadinessFlow({
      ...base,
      suitePass: 7,
      casesRun: 8,
    });
    expect(isSuiteComplete(7, 8, 8)).toBe(true);
    expect(state.phase).toBe("ingest");
  });

  it("reaches complete when ingest and traffic confirmed", () => {
    const state = computeReadinessFlow({
      ...base,
      suitePass: 8,
      casesRun: 8,
      ingestDone: true,
      trafficConfirmed: true,
    });
    expect(state.phase).toBe("complete");
    expect(state.productionReady).toBe(true);
    expect(readinessScoreFromFlow({ ...base, suitePass: 8, casesRun: 8, ingestDone: true, trafficConfirmed: true })).toBeGreaterThanOrEqual(80);
  });

  it("computeReadinessFromMilestones uses session milestones", () => {
    const storage: Record<string, string> = {};
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => storage[k] ?? null,
      setItem: (k: string, v: string) => {
        storage[k] = v;
      },
    });
    storage["artsa-readiness-milestones"] = JSON.stringify({
      suiteCompletedAt: new Date().toISOString(),
    });

    const state = computeReadinessFromMilestones({
      apiOnline: true,
      wsConnected: true,
      hasTraffic: false,
    });
    expect(state.phase).toBe("ingest");
    vi.unstubAllGlobals();
  });
});
