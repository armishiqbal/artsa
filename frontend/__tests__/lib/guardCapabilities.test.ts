import { describe, it, expect } from "vitest";
import {
  GUARD_FEATURE_CATEGORIES,
  LAKERA_FEATURE_COUNT,
  LAKERA_GUARD_FEATURES,
} from "@/lib/guardCapabilities";

describe("guardCapabilities", () => {
  it("exports the full categorized catalog", () => {
    expect(GUARD_FEATURE_CATEGORIES.length).toBeGreaterThanOrEqual(6);
    expect(LAKERA_FEATURE_COUNT).toBe(LAKERA_GUARD_FEATURES.length);
    expect(LAKERA_FEATURE_COUNT).toBeGreaterThanOrEqual(40);
  });

  it("covers five defense categories", () => {
    const ids = GUARD_FEATURE_CATEGORIES.map((c) => c.id);
    expect(ids).toContain("prompt-defense");
    expect(ids).toContain("content-moderation");
    expect(ids).toContain("data-leakage");
    expect(ids).toContain("malicious-links");
    expect(ids).toContain("agent-behavior");
  });
});
