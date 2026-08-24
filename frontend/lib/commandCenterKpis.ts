import type { CampaignListItem } from "@/lib/hooks/useCampaigns";
import { deriveIncidentKpis } from "@/lib/incidentKpis";

export interface CommandCenterKpis {
  threatsBlocked: number;
  pendingTriage: number;
  playbookVersion: string;
  lastScanLabel: string;
  detectionSparkline: number[];
}

interface DashboardMetricsLike {
  severity_counts?: Record<string, number>;
  defense_score?: number;
  risk_trend?: Array<{ risk_score: number }>;
  total_events?: number;
}

type LiveEventLike = Record<string, unknown>;

function isBlocked(evt: LiveEventLike): boolean {
  const verdict = String(evt.verdict ?? "").toUpperCase();
  return verdict.includes("BLOCK") || verdict.includes("QUARANTINE") || verdict.includes("KILL");
}

function latestEventTime(events: LiveEventLike[]): string | null {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const ts = events[i].timestamp ?? events[i].created_at;
    if (ts) return String(ts);
  }
  return null;
}

function formatScanLabel(iso: string | null | undefined): string {
  if (!iso) return "No scan yet";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "No scan yet";
  const diffMs = Date.now() - t;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Executive KPI row for Command Center — CISO-legible, sourced from live metrics. */
export function deriveCommandCenterKpis(
  metrics: DashboardMetricsLike | null,
  liveEvents: LiveEventLike[],
  playbookVersion: number,
  campaigns: CampaignListItem[]
): CommandCenterKpis {
  const counts = metrics?.severity_counts ?? {};
  const critical = Number(counts.CRITICAL ?? 0);
  const high = Number(counts.HIGH ?? 0);
  const medium = Number(counts.MEDIUM ?? 0);

  const blockedFromEvents = liveEvents.filter(isBlocked).length;
  const incident = deriveIncidentKpis(metrics, liveEvents);
  const threatsBlocked = Math.max(blockedFromEvents, incident.blocked_prompt_injections);

  const pendingTriage = critical + high + Math.floor(medium / 2);

  const playbookVersionLabel =
    playbookVersion > 0 ? `v${playbookVersion}` : "v1.0";

  const latestCampaign = campaigns[0];
  const campaignTime =
    (latestCampaign?.summary?.completed_at as string | undefined) ??
    (latestCampaign?.summary?.started_at as string | undefined);
  const eventTime = latestEventTime(liveEvents);
  const lastScanLabel = formatScanLabel(campaignTime ?? eventTime);

  const detectionSparkline = (metrics?.risk_trend ?? [])
    .slice(-12)
    .map((p) => Math.max(0, 100 - Number(p.risk_score ?? 0)));

  if (detectionSparkline.length < 2 && (metrics?.defense_score ?? 0) > 0) {
    const score = metrics!.defense_score!;
    return {
      threatsBlocked,
      pendingTriage,
      playbookVersion: playbookVersionLabel,
      lastScanLabel,
      detectionSparkline: Array(8).fill(score),
    };
  }

  return {
    threatsBlocked,
    pendingTriage,
    playbookVersion: playbookVersionLabel,
    lastScanLabel,
    detectionSparkline:
      detectionSparkline.length >= 2
        ? detectionSparkline
        : [0, metrics?.defense_score ?? 0],
  };
}
