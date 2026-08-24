import type { CampaignListItem } from "@/lib/hooks/useCampaigns";
import { asiForAttackCategory } from "@/lib/asiCategories";
import { parseTopFindings } from "@/lib/campaignTranscript";
import { findingFingerprint, isFindingPromoted } from "@/lib/findingStatus";
import { severityFromScore } from "@/lib/severity";

export type FindingStatus =
  | "new"
  | "validated"
  | "sandboxed"
  | "promoted"
  | "deployed";

export interface FindingRow {
  id: string;
  title: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  asiCode: string | null;
  asiLabel: string | null;
  category: string;
  status: FindingStatus;
  timestamp: string | null;
  source: "telemetry" | "campaign" | "sandbox";
  href?: string;
}

type LiveEventLike = Record<string, unknown>;

function eventSeverity(evt: LiveEventLike): FindingRow["severity"] {
  const score = Number(evt.risk_score ?? 0);
  if (score > 0) return severityFromScore(score);
  const sev = String(evt.severity ?? "MEDIUM").toUpperCase();
  if (sev === "CRITICAL" || sev === "HIGH" || sev === "MEDIUM" || sev === "LOW") return sev;
  return "MEDIUM";
}

function findingsFromTelemetry(events: LiveEventLike[]): FindingRow[] {
  return events
    .filter((evt) => {
      const score = Number(evt.risk_score ?? 0);
      const sev = String(evt.severity ?? "").toUpperCase();
      return score >= 50 || sev === "HIGH" || sev === "CRITICAL";
    })
    .slice(-40)
    .reverse()
    .map((evt, idx) => {
      const tool = String(evt.tool_name ?? "event");
      const session = String(evt.session_id ?? evt.agent_id ?? "session");
      const title = `${tool} · ${session.slice(0, 8)}`;
      const fp = findingFingerprint({ source: "telemetry", title, category: tool });
      const promoted = isFindingPromoted(fp);
      return {
        id: `telemetry-${idx}-${session}`,
        title,
        severity: eventSeverity(evt),
        asiCode: asiForAttackCategory("DPI")?.code ?? null,
        asiLabel: asiForAttackCategory("DPI")?.label ?? null,
        category: tool,
        status: promoted ? "promoted" : "new",
        timestamp: String(evt.timestamp ?? evt.created_at ?? "") || null,
        source: "telemetry" as const,
        href: session ? `/replay?session=${encodeURIComponent(session)}` : "/logs",
      };
    });
}

function findingsFromCampaigns(campaigns: CampaignListItem[]): FindingRow[] {
  const rows: FindingRow[] = [];
  for (const campaign of campaigns) {
    const summary = campaign.summary as Record<string, unknown> | undefined;
    if (!summary) continue;
    const turns = parseTopFindings(summary);
    for (const turn of turns) {
      const fp = findingFingerprint({
        source: `campaign-${campaign.id}`,
        title: turn.attackName,
        category: turn.category,
      });
      const promoted = isFindingPromoted(fp);
      rows.push({
        id: `campaign-${campaign.id}-${turn.roundNumber}`,
        title: turn.attackName,
        severity:
          turn.severity === "CRITICAL" ||
          turn.severity === "HIGH" ||
          turn.severity === "MEDIUM" ||
          turn.severity === "LOW"
            ? turn.severity
            : severityFromScore(turn.attackSuccessScore * 10),
        asiCode: turn.asiCode,
        asiLabel: turn.asiLabel,
        category: turn.category,
        status: promoted ? "promoted" : "validated",
        timestamp:
          (summary.completed_at as string | undefined) ??
          (summary.started_at as string | undefined) ??
          null,
        source: "campaign",
        href: `/campaigns`,
      });
    }
  }
  return rows;
}

/** Aggregate findings from live telemetry and completed campaign summaries. */
export function deriveFindings(
  liveEvents: LiveEventLike[],
  campaigns: CampaignListItem[]
): FindingRow[] {
  const merged = [...findingsFromCampaigns(campaigns), ...findingsFromTelemetry(liveEvents)];
  const byId = new Map<string, FindingRow>();
  for (const row of merged) {
    if (!byId.has(row.id)) byId.set(row.id, row);
  }
  return [...byId.values()].sort((a, b) => {
    const ta = a.timestamp ? Date.parse(a.timestamp) : 0;
    const tb = b.timestamp ? Date.parse(b.timestamp) : 0;
    return tb - ta;
  });
}

export const FINDING_STATUS_LABELS: Record<FindingStatus, string> = {
  new: "New",
  validated: "Validated",
  sandboxed: "Sandboxed",
  promoted: "Promoted",
  deployed: "Deployed",
};
