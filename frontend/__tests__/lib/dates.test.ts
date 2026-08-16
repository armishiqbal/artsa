import { describe, it, expect } from "vitest";
import { formatDateTime, formatDate, safeTimestamp } from "@/lib/dates";

describe("formatDateTime", () => {
  it("formats a valid ISO string", () => {
    expect(formatDateTime("2026-08-15T10:30:00Z")).not.toBe("—");
    expect(formatDateTime("2026-08-15T10:30:00Z")).not.toContain("Invalid");
  });

  it("returns the placeholder for null / undefined / empty", () => {
    expect(formatDateTime(null)).toBe("—");
    expect(formatDateTime(undefined)).toBe("—");
    expect(formatDateTime("")).toBe("—");
  });

  it("returns the placeholder instead of 'Invalid Date' for malformed input", () => {
    expect(formatDateTime("not-a-date")).toBe("—");
    expect(formatDateTime("2026-99-99T99:99:00Z")).toBe("—");
  });
});

describe("formatDate", () => {
  it("formats a valid ISO date and degrades safely", () => {
    expect(formatDate("2026-08-15T10:30:00Z")).not.toBe("—");
    expect(formatDate("garbage")).toBe("—");
    expect(formatDate(null)).toBe("—");
  });
});

describe("safeTimestamp", () => {
  it("returns a numeric timestamp for valid input", () => {
    expect(safeTimestamp("2026-08-15T10:30:00Z")).toBeTypeOf("number");
    expect(Number.isNaN(safeTimestamp("2026-08-15T10:30:00Z"))).toBe(false);
  });

  it("returns 0 for invalid input so sorts are stable (never NaN)", () => {
    expect(safeTimestamp("garbage")).toBe(0);
    expect(safeTimestamp(null)).toBe(0);
    expect(safeTimestamp(undefined)).toBe(0);
    expect(Number.isNaN(safeTimestamp("garbage"))).toBe(false);
  });
});
