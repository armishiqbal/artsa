/**
 * Client-side experiment registry for Lab runs.
 * Names still use `Lab · technique · strategy`; this log stores structured metadata
 * so history isn't limited to string-prefix matching.
 */

const STORAGE_KEY = "artsa.lab.experimentLog.v1";

export type LabExperimentRecord = {
  campaignId: string;
  technique: string;
  strategy: string;
  intensity: number;
  iterations: number;
  mutation: boolean;
  categories: string[];
  startedAt: string;
};

function readAll(): LabExperimentRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is LabExperimentRecord =>
        Boolean(r && typeof r === "object" && typeof (r as LabExperimentRecord).campaignId === "string")
    );
  } catch {
    return [];
  }
}

function writeAll(rows: LabExperimentRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows.slice(0, 80)));
  } catch {
    /* quota / private mode — ignore */
  }
}

export function recordLabExperiment(entry: LabExperimentRecord): void {
  const prev = readAll().filter((r) => r.campaignId !== entry.campaignId);
  writeAll([entry, ...prev]);
}

export function listLabExperiments(): LabExperimentRecord[] {
  return readAll();
}

/** Parse `Lab · Technique · Strategy` names used by Attack Lab launches. */
export function parseLabCampaignName(name: string): {
  isLab: boolean;
  technique: string | null;
  strategy: string | null;
} {
  const m = String(name || "").match(/^Lab\s·\s(.+?)\s·\s(.+)$/);
  if (!m) {
    return {
      isLab: String(name || "").startsWith("Lab ·"),
      technique: null,
      strategy: null,
    };
  }
  return { isLab: true, technique: m[1]!.trim(), strategy: m[2]!.trim() };
}

export type ExperimentLogRow = {
  campaignId: string;
  name: string;
  technique: string;
  strategy: string;
  status: string;
  roundsDone: number;
  roundsTotal: number;
  risk: number | null;
  startedAt: string | null;
  source: "registry" | "name";
  href: string;
};

/** Merge local registry + Lab · named campaigns into one analyst log. */
export function deriveExperimentLog(
  campaigns: Array<{
    id: string;
    name: string;
    status: string;
    rounds_completed: number;
    total_rounds: number;
    summary?: Record<string, unknown> | null;
  }>,
  riskOf: (summary: Record<string, unknown> | null | undefined) => number | null
): ExperimentLogRow[] {
  const byId = new Map(campaigns.map((c) => [c.id, c]));
  const registry = listLabExperiments();
  const seen = new Set<string>();
  const out: ExperimentLogRow[] = [];

  for (const r of registry) {
    const c = byId.get(r.campaignId);
    if (!c) continue;
    seen.add(c.id);
    out.push({
      campaignId: c.id,
      name: c.name,
      technique: r.technique,
      strategy: r.strategy,
      status: c.status,
      roundsDone: c.rounds_completed,
      roundsTotal: c.total_rounds,
      risk: riskOf(c.summary ?? null),
      startedAt: r.startedAt,
      source: "registry",
      href: `/red-team/monitor/${c.id}?follow=1`,
    });
  }

  for (const c of campaigns) {
    if (seen.has(c.id)) continue;
    const parsed = parseLabCampaignName(c.name);
    if (!parsed.isLab) continue;
    out.push({
      campaignId: c.id,
      name: c.name,
      technique: parsed.technique ?? "Lab",
      strategy: parsed.strategy ?? "—",
      status: c.status,
      roundsDone: c.rounds_completed,
      roundsTotal: c.total_rounds,
      risk: riskOf(c.summary ?? null),
      startedAt: null,
      source: "name",
      href: `/red-team/monitor/${c.id}?follow=1`,
    });
  }

  return out;
}

/** Technique history using registry + name prefix (not name-only). */
export function campaignMatchesTechnique(
  campaign: { id: string; name: string },
  technique: string,
  registry: LabExperimentRecord[] = listLabExperiments()
): boolean {
  if (registry.some((r) => r.campaignId === campaign.id && r.technique === technique)) {
    return true;
  }
  const parsed = parseLabCampaignName(campaign.name);
  if (parsed.technique === technique) return true;
  return String(campaign.name || "").startsWith(`Lab · ${technique}`);
}
