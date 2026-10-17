import { describe, expect, it } from "vitest";
import {
  ADVERSARIAL_PRESETS,
  getPresetById,
  searchPresets,
} from "@/lib/playgroundAdversarialPresets";

describe("playgroundAdversarialPresets", () => {
  it("defines all 8 adversarial presets with complete security metadata", () => {
    expect(ADVERSARIAL_PRESETS.length).toBe(8);
    for (const preset of ADVERSARIAL_PRESETS) {
      expect(preset.id).toBeTruthy();
      expect(preset.title).toBeTruthy();
      expect(preset.category).toBeTruthy();
      expect(preset.categoryCode).toMatch(/^(DPI|JBK|DEX|PEX|IPI|MSE)$/);
      expect(preset.owasp).toMatch(/^OWASP LLM/);
      expect(preset.atlas).toMatch(/^AML\.T/);
      expect(preset.prompt.length).toBeGreaterThan(15);
      expect(preset.dangerSpans.length).toBeGreaterThanOrEqual(2);
      expect(preset.unmitigatedOutcome.length).toBeGreaterThan(10);
      expect(preset.suggestedRule.pattern.length).toBeGreaterThan(5);
    }
  });

  it("verifies danger span text exists within the corresponding prompt", () => {
    for (const preset of ADVERSARIAL_PRESETS) {
      for (const span of preset.dangerSpans) {
        expect(preset.prompt).toContain(span.text);
        expect(span.tag.length).toBeGreaterThan(0);
        expect(span.reason.length).toBeGreaterThan(0);
      }
    }
  });

  it("retrieves preset by ID", () => {
    const found = getPresetById("adv-dpi-01");
    expect(found).toBeDefined();
    expect(found?.title).toContain("System Prompt Extraction");

    const missing = getPresetById("non-existent");
    expect(missing).toBeUndefined();
  });

  it("filters presets by search query and categoryCode", () => {
    const dpi = searchPresets("", "DPI");
    expect(dpi.length).toBe(2);
    expect(dpi.every((p) => p.categoryCode === "DPI")).toBe(true);

    const base64Results = searchPresets("Base64");
    expect(base64Results.length).toBeGreaterThanOrEqual(1);
    expect(base64Results[0].id).toBe("adv-cph-03");

    const empty = searchPresets("completely_unmatched_query_xyz");
    expect(empty.length).toBe(0);
  });
});
