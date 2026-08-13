/**
 * Token-level highlight utilities for the Attack Sandbox explainability view.
 * Splits a prompt string into segments based on trigger-phrase spans returned
 * by the backend /playground/evaluate endpoint.
 */

export interface HighlightSpan {
  phrase: string;
  start: number;
  end: number;
}

export interface HighlightSegment {
  text: string;
  highlighted: boolean;
  phrase?: string;
}

/**
 * Split `text` into highlighted/normal segments using non-overlapping spans.
 * Spans are clamped to the text length and sorted by start position.
 */
export function splitWithHighlights(text: string, spans: HighlightSpan[]): HighlightSegment[] {
  if (!text) return [];

  const valid = (spans ?? [])
    .filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end))
    .map((s) => ({
      start: Math.max(0, Math.min(text.length, s.start)),
      end: Math.max(0, Math.min(text.length, s.end)),
      phrase: s.phrase,
    }))
    .filter((s) => s.start < s.end)
    .sort((a, b) => a.start - b.start);

  const segments: HighlightSegment[] = [];
  let cursor = 0;

  for (const span of valid) {
    if (span.start < cursor) continue; // overlapping span — first match wins
    if (span.start > cursor) {
      segments.push({ text: text.slice(cursor, span.start), highlighted: false });
    }
    segments.push({
      text: text.slice(span.start, span.end),
      highlighted: true,
      phrase: span.phrase,
    });
    cursor = Math.max(cursor, span.end);
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), highlighted: false });
  }

  return segments;
}

/** Class name mapping for highlighted segments (severity-tinted). */
export function highlightClassName(severity: "high" | "critical" = "critical"): string {
  return severity === "critical"
    ? "rounded bg-red-500/20 px-0.5 font-semibold text-red-400 ring-1 ring-red-500/40"
    : "rounded bg-amber-500/20 px-0.5 font-semibold text-amber-400 ring-1 ring-amber-500/40";
}
