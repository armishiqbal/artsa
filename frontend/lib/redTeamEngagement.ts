/**
 * Red Team engagement helpers — probe loadout + prior posture from history.
 */

import type { CampaignListItem } from "@/lib/hooks/useCampaigns";

export interface ProbeWeight {
  code: string;
  label: string;
  weight: number;
}

export interface TargetPosture {
  scanCount: number;
  completedCount: number;
  avgAttack: number | null;
  lastStatus: string | null;
  lastRounds: string | null;
  /** 0–10 avg attack success across completed scans for this target */
  pressure: "unset" | "low" | "medium" | "high";
}

export function buildProbeLoadout(
  categories: string[],
  weights: Record<string, number>,
  labels: Record<string, string>
): ProbeWeight[] {
  return categories.map((code) => ({
    code,
    label: labels[code] ?? code,
    weight: Number(weights[code]) || 0,
  }));
}

/** Prior scan pressure for the selected target (history only — no demo data). */
export function deriveTargetPosture(
  campaigns: CampaignListItem[],
  providerKey?: string | null
): TargetPosture {
  if (!providerKey) {
    return {
      scanCount: 0,
      completedCount: 0,
      avgAttack: null,
      lastStatus: null,
      lastRounds: null,
      pressure: "unset",
    };
  }
  const key = providerKey.toLowerCase();
  const matched = campaigns.filter(
    (c) =>
      c.provider.toLowerCase() === key ||
      c.provider.toLowerCase().includes(key) ||
      key.includes(c.provider.toLowerCase())
  );
  const completed = matched.filter((c) => c.status.toUpperCase() === "COMPLETED");
  const scores = completed
    .map((c) => Number(c.summary?.avg_attack_success))
    .filter((n) => Number.isFinite(n));
  const avgAttack =
    scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  const last = matched[0] ?? null;
  let pressure: TargetPosture["pressure"] = "unset";
  if (avgAttack != null) {
    if (avgAttack >= 6) pressure = "high";
    else if (avgAttack >= 3.5) pressure = "medium";
    else pressure = "low";
  }
  return {
    scanCount: matched.length,
    completedCount: completed.length,
    avgAttack,
    lastStatus: last?.status ?? null,
    lastRounds: last
      ? `${last.rounds_completed}/${last.total_rounds || "—"}`
      : null,
    pressure,
  };
}
