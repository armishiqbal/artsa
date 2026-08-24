/** Persist promoted finding fingerprints so the Findings table can show lifecycle state. */

const STORAGE_KEY = "artsa-promoted-findings";

function safeRead(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function markFindingPromoted(fingerprint: string): void {
  if (typeof window === "undefined" || !fingerprint) return;
  const set = new Set(safeRead());
  set.add(fingerprint);
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
}

export function isFindingPromoted(fingerprint: string): boolean {
  return safeRead().includes(fingerprint);
}

export function findingFingerprint(parts: {
  source: string;
  title: string;
  category?: string;
}): string {
  return `${parts.source}::${parts.category ?? "general"}::${parts.title}`.slice(0, 240);
}
