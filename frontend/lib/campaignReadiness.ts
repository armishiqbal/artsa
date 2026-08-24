const WARGAME_STORAGE_KEY = "artsa-wargame-readiness";

export interface WargameReadinessRecord {
  campaign_id: string;
  completed_at: string;
  summary: Record<string, unknown>;
}

export function loadWargameReadinessRecords(): WargameReadinessRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(WARGAME_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WargameReadinessRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveWargameReadinessRecord(record: WargameReadinessRecord): void {
  if (typeof window === "undefined") return;
  try {
    const existing = loadWargameReadinessRecords().filter((r) => r.campaign_id !== record.campaign_id);
    sessionStorage.setItem(WARGAME_STORAGE_KEY, JSON.stringify([record, ...existing].slice(0, 5)));
  } catch {
    /* ignore */
  }
}

export function wargameAppendixForReport(
  records: WargameReadinessRecord[]
): Record<string, unknown>[] {
  return records.map((r) => ({
    campaign_id: r.campaign_id,
    completed_at: r.completed_at,
    completed_rounds: r.summary.completed_rounds ?? r.summary.total_rounds,
    avg_attack_success: r.summary.avg_attack_success,
    avg_defense_quality: r.summary.avg_defense_quality,
    avg_bypass_depth: r.summary.avg_bypass_depth,
    results_by_verdict: r.summary.results_by_verdict,
    results_by_category: r.summary.results_by_category,
  }));
}
