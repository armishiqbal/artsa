/**
 * Safe date helpers. Backend timestamps are ISO strings, but a malformed or
 * null value must never reach `new Date(...).toLocaleString()` — that renders
 * the literal string "Invalid Date" (it does NOT throw, so try/catch alone
 * does not protect you). Every consumer formats through these helpers so an
 * upstream hiccup degrades to a placeholder instead of leaking "Invalid Date".
 */

function isValidDate(iso: string | null | undefined): iso is string {
  if (!iso) return false;
  const d = new Date(iso);
  return !Number.isNaN(d.getTime());
}

/** Format a date-time for display, falling back to "—" for missing/invalid input. */
export function formatDateTime(iso: string | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!isValidDate(iso)) return "—";
  return new Date(iso).toLocaleString(undefined, opts);
}

/** Format a date only, falling back to "—" for missing/invalid input. */
export function formatDate(iso: string | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!isValidDate(iso)) return "—";
  return new Date(iso).toLocaleDateString(undefined, opts);
}

/**
 * Stable numeric sort key for ISO timestamps. Invalid input sorts last (0)
 * instead of poisoning a comparator with NaN (which makes sort order arbitrary).
 */
export function safeTimestamp(iso: string | null | undefined): number {
  if (!isValidDate(iso)) return 0;
  return new Date(iso).getTime();
}
