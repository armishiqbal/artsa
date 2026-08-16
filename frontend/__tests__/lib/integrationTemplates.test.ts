import { describe, it, expect } from "vitest";
import {
  buildSampleTemplate,
  extractSecretRefs,
  usesDefaultPayload,
  validatePayloadTemplate,
} from "@/lib/integrationTemplates";

describe("validatePayloadTemplate", () => {
  it("accepts valid JSON", () => {
    expect(validatePayloadTemplate('{"a": 1}')).toBeNull();
    expect(validatePayloadTemplate('{"nested": {"list": [1, 2]}}')).toBeNull();
  });

  it("accepts empty / whitespace as a no-template", () => {
    expect(validatePayloadTemplate("")).toBeNull();
    expect(validatePayloadTemplate("   ")).toBeNull();
  });

  it("rejects invalid JSON with a message", () => {
    expect(validatePayloadTemplate("{ not json")).toMatch(/JSON/i);
  });
});

describe("extractSecretRefs", () => {
  it("collects secret refs from headers and template, deduped and sorted", () => {
    const refs = extractSecretRefs(
      { Authorization: "Bearer {{secret:token}}", "X-Env": "prod" },
      '{"sig": "{{secret:signature}}", "again": "{{secret:token}}"}'
    );
    expect(refs).toEqual(["signature", "token"]);
  });

  it("returns an empty list when no refs exist", () => {
    expect(extractSecretRefs({}, null)).toEqual([]);
    expect(extractSecretRefs({ "X-Env": "prod" }, '{"a": 1}')).toEqual([]);
  });

  it("ignores non-secret placeholders", () => {
    const refs = extractSecretRefs({}, '{"agent": "{{agent_id}}"}');
    expect(refs).toEqual([]);
  });
});

describe("buildSampleTemplate", () => {
  it("renders valid JSON for every event type", () => {
    for (const type of ["alert", "tool_call", "proxy_call", "session_action"] as const) {
      const json = buildSampleTemplate(type);
      expect(() => JSON.parse(json)).not.toThrow();
      const parsed = JSON.parse(json) as Record<string, string>;
      expect(parsed.source).toBe("ARTSA");
      expect(Object.keys(parsed).length).toBeGreaterThan(3);
    }
  });

  it("alert template carries the alert-specific fields", () => {
    const parsed = JSON.parse(buildSampleTemplate("alert")) as Record<string, string>;
    expect(parsed).toMatchObject({ alert_id: "{{id}}", severity: "{{severity}}", risk_score: "{{risk_score}}" });
  });
});

describe("usesDefaultPayload", () => {
  it("is true for null or empty templates", () => {
    expect(usesDefaultPayload({ payload_template: null })).toBe(true);
    expect(usesDefaultPayload({ payload_template: "  " })).toBe(true);
  });

  it("is false for a custom template", () => {
    expect(usesDefaultPayload({ payload_template: '{"a": 1}' })).toBe(false);
  });
});
