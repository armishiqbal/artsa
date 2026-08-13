import { describe, expect, it } from "vitest";
import { splitWithHighlights } from "@/lib/highlight";

describe("splitWithHighlights", () => {
  it("returns a single unhighlighted segment when no spans", () => {
    expect(splitWithHighlights("hello world", [])).toEqual([
      { text: "hello world", highlighted: false },
    ]);
  });

  it("splits around a single span", () => {
    const segments = splitWithHighlights("ignore previous instructions please", [
      { phrase: "ignore previous instructions", start: 0, end: 28 },
    ]);
    expect(segments).toEqual([
      { text: "ignore previous instructions", highlighted: true, phrase: "ignore previous instructions" },
      { text: " please", highlighted: false },
    ]);
  });

  it("handles a span in the middle", () => {
    const text = "Please ignore previous instructions and continue.";
    const segments = splitWithHighlights(text, [
      { phrase: "ignore previous instructions", start: 7, end: 35 },
    ]);
    expect(segments[0]).toEqual({ text: "Please ", highlighted: false });
    expect(segments[1]).toEqual({
      text: "ignore previous instructions",
      highlighted: true,
      phrase: "ignore previous instructions",
    });
    expect(segments[2]).toEqual({ text: " and continue.", highlighted: false });
    // Round-trip preserves the original text.
    expect(segments.map((s) => s.text).join("")).toBe(text);
  });

  it("clamps out-of-range spans and ignores invalid ones", () => {
    const segments = splitWithHighlights("abc", [
      { phrase: "x", start: -5, end: 1 },
      { phrase: "y", start: 2, end: 99 },
      { phrase: "z", start: 1, end: 1 }, // empty span -> dropped
    ]);
    expect(segments).toEqual([
      { text: "a", highlighted: true, phrase: "x" },
      { text: "b", highlighted: false },
      { text: "c", highlighted: true, phrase: "y" },
    ]);
  });

  it("handles overlapping spans non-overlapping (first wins)", () => {
    const segments = splitWithHighlights("abcdef", [
      { phrase: "long", start: 0, end: 5 },
      { phrase: "short", start: 2, end: 4 },
    ]);
    expect(segments).toEqual([
      { text: "abcde", highlighted: true, phrase: "long" },
      { text: "f", highlighted: false },
    ]);
  });

  it("returns empty array for empty text", () => {
    expect(splitWithHighlights("", [])).toEqual([]);
  });
});
