/**
 * Enterprise analytics — derive SOC-grade series from live metrics + telemetry only.
 * Never fabricates demo time series when data is missing.
 */

import {
  normalizeContainmentAction,
  type ContainmentAction,
} from "@/lib/securityLog";
import { severityFromScore, type SeverityLabel } from "@/lib/severity";
import { safeTimestamp } from "@/lib/dates";
import { LAYER_LABELS } from "@/lib/layerLabels";

export interface AnalyticsMetricsLike {
  severity_counts?: Record<string, number>;
  avg_risk_score?: number | null;
  max_risk_score?: number | null;
  defense_score?: number | null;
  defense_layers?: Record<string, number>;
  risk_trend?: Array<{ timestamp?: string; risk_score?: number; tool_name?: string }>;
  total_events?: number;
  active_sessions?: number;
}

type LiveEventLike = Record<string, unknown>;

export interface SeveritySlice {
  key: SeverityLabel;
  label: string;
  value: number;
  fill: string;
}

export interface ActionSlice {
  key: ContainmentAction;
  label: string;
  value: number;
  fill: string;
}

export interface RankedItem {
  name: string;
  count: number;
  avgRisk: number;
  maxRisk: number;
}

export interface VolumeBucket {
  label: string;
  count: number;
  critical: number;
  high: number;
}

export interface RiskTrendPoint {
  name: number;
  label: string;
  score: number;
  criticalLine: number;
  highLine: number;
}

export interface EnterpriseAnalytics {
  totalEvents: number;
  containedCount: number;
  containmentRate: number;
  avgRisk: number;
  maxRisk: number;
  defenseScore: number;
  severitySlices: SeveritySlice[];
  actionSlices: ActionSlice[];
  topTools: RankedItem[];
  topAgents: RankedItem[];
  volume: VolumeBucket[];
  riskTrend: RiskTrendPoint[];
  defenseLayers: Array<{ key: string; label: string; value: number }>;
  hasLiveSignal: boolean;
}

const SEVERITY_FILL: Record<SeverityLabel, string> = {
  CRITICAL: "hsl(var(--severity-critical))",
  HIGH: "hsl(var(--severity-high))",
  MEDIUM: "hsl(var(--severity-medium))",
  LOW: "hsl(var(--severity-low))",
};

const ACTION_FILL: Partial<Record<ContainmentAction, string>> = {
  KILL: "hsl(var(--severity-critical))",
  QUARANTINE: "hsl(var(--severity-high))",
  FLAG: "hsl(var(--severity-medium))",
  ESCALATE: "hsl(var(--severity-medium))",
  ALLOW: "#454545",
  UNKNOWN: "#313131",
};

function eventTime(evt: LiveEventLike): number {
  return safeTimestamp(String(evt.triggered_at ?? evt.ts ?? ""));
}

function rankByField(
  events: LiveEventLike[],
  field: "tool_name" | "agent_id",
  limit = 8
): RankedItem[] {
  const map = new Map<string, { count: number; sum: number; max: number }>();
  for (const evt of events) {
    const name = String(evt[field] ?? "").trim() || "unknown";
    if (field === "tool_name" && (name === "session" || name === "unknown")) continue;
    const risk = Number(evt.risk_score ?? 0);
    const prev = map.get(name) ?? { count: 0, sum: 0, max: 0 };
    map.set(name, {
      count: prev.count + 1,
      sum: prev.sum + (Number.isFinite(risk) ? risk : 0),
      max: Math.max(prev.max, Number.isFinite(risk) ? risk : 0),
    });
  }
  return Array.from(map.entries())
    .map(([name, v]) => ({
      name,
      count: v.count,
      avgRisk: v.count ? Math.round(v.sum / v.count) : 0,
      maxRisk: Math.round(v.max),
    }))
    .sort((a, b) => b.maxRisk - a.maxRisk || b.count - a.count)
    .slice(0, limit);
}

function buildVolume(events: LiveEventLike[]): VolumeBucket[] {
  if (!events.length) return [];
  const buckets = new Map<string, VolumeBucket>();
  for (const evt of events) {
    const ts = eventTime(evt);
    const d = ts ? new Date(ts) : null;
    const label = d
      ? d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
      : "—";
    const risk = Number(evt.risk_score ?? 0);
    const sev = severityFromScore(Number.isFinite(risk) ? risk : 0);
    const prev = buckets.get(label) ?? { label, count: 0, critical: 0, high: 0 };
    prev.count += 1;
    if (sev === "CRITICAL") prev.critical += 1;
    if (sev === "HIGH") prev.high += 1;
    buckets.set(label, prev);
  }
  return Array.from(buckets.values()).slice(-16);
}

function buildRiskTrend(metrics: AnalyticsMetricsLike | null, events: LiveEventLike[]): RiskTrendPoint[] {
  const trend = metrics?.risk_trend ?? [];
  if (trend.length > 0) {
    return trend.map((p, i) => ({
      name: i + 1,
      label: p.timestamp
        ? new Date(p.timestamp).toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
          })
        : `#${i + 1}`,
      score: Number(p.risk_score ?? 0),
      criticalLine: 80,
      highLine: 50,
    }));
  }

  // Derive from live events when API trend is empty
  const scored = events
    .map((e) => ({
      t: eventTime(e),
      score: Number(e.risk_score ?? 0),
    }))
    .filter((e) => e.t > 0 && Number.isFinite(e.score))
    .sort((a, b) => a.t - b.t)
    .slice(-24);

  return scored.map((p, i) => ({
    name: i + 1,
    label: new Date(p.t).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    }),
    score: p.score,
    criticalLine: 80,
    highLine: 50,
  }));
}

export function deriveEnterpriseAnalytics(
  metrics: AnalyticsMetricsLike | null,
  liveEvents: LiveEventLike[]
): EnterpriseAnalytics {
  const counts = metrics?.severity_counts ?? {};
  const severityOrder: SeverityLabel[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

  let severitySlices: SeveritySlice[] = severityOrder.map((key) => ({
    key,
    label: key,
    value: Number(counts[key] ?? 0),
    fill: SEVERITY_FILL[key],
  }));

  // Fall back to live event severity if metrics empty
  if (severitySlices.every((s) => s.value === 0) && liveEvents.length > 0) {
    const tallies: Record<SeverityLabel, number> = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
    };
    for (const evt of liveEvents) {
      tallies[severityFromScore(Number(evt.risk_score ?? 0))] += 1;
    }
    severitySlices = severityOrder.map((key) => ({
      key,
      label: key,
      value: tallies[key],
      fill: SEVERITY_FILL[key],
    }));
  }

  const actionTallies: Record<ContainmentAction, number> = {
    KILL: 0,
    QUARANTINE: 0,
    FLAG: 0,
    ESCALATE: 0,
    ALLOW: 0,
    UNKNOWN: 0,
  };
  for (const evt of liveEvents) {
    const action = normalizeContainmentAction(
      String(evt.action ?? evt.recommended_action ?? ""),
      String(evt.verdict ?? "")
    );
    actionTallies[action] += 1;
  }
  const actionSlices: ActionSlice[] = (
    ["KILL", "QUARANTINE", "FLAG", "ESCALATE", "ALLOW", "UNKNOWN"] as ContainmentAction[]
  )
    .filter((k) => actionTallies[k] > 0)
    .map((key) => ({
      key,
      label: key,
      value: actionTallies[key],
      fill: ACTION_FILL[key] ?? "#454545",
    }));

  const containedCount =
    actionTallies.KILL + actionTallies.QUARANTINE + actionTallies.FLAG + actionTallies.ESCALATE;
  const totalEvents = Math.max(
    Number(metrics?.total_events ?? 0),
    liveEvents.length,
    severitySlices.reduce((s, x) => s + x.value, 0)
  );
  const containmentRate =
    liveEvents.length > 0 ? Math.round((containedCount / liveEvents.length) * 100) : 0;

  const riskScores = liveEvents
    .map((e) => Number(e.risk_score ?? 0))
    .filter((n) => Number.isFinite(n));
  const avgRisk =
    riskScores.length > 0
      ? Math.round(riskScores.reduce((a, b) => a + b, 0) / riskScores.length)
      : Math.round(Number(metrics?.avg_risk_score ?? 0));
  const maxRisk =
    riskScores.length > 0
      ? Math.round(Math.max(...riskScores))
      : Math.round(Number(metrics?.max_risk_score ?? 0));

  const riskTrend = buildRiskTrend(metrics, liveEvents);
  const defenseLayers = Object.entries(metrics?.defense_layers ?? {}).map(([key, value]) => ({
    key,
    label: LAYER_LABELS[key] ?? key.replace(/_/g, " "),
    value: Number(value) || 0,
  }));

  return {
    totalEvents,
    containedCount,
    containmentRate,
    avgRisk,
    maxRisk,
    defenseScore: Math.round(Number(metrics?.defense_score ?? 0)),
    severitySlices,
    actionSlices,
    topTools: rankByField(liveEvents, "tool_name"),
    topAgents: rankByField(liveEvents, "agent_id"),
    volume: buildVolume(liveEvents),
    riskTrend,
    defenseLayers,
    hasLiveSignal:
      totalEvents > 0 ||
      riskTrend.length > 0 ||
      liveEvents.length > 0 ||
      defenseLayers.length > 0,
  };
}

export function analyticsBundleToCsv(analytics: EnterpriseAnalytics): string {
  const lines = [
    "section,key,value",
    `kpi,total_events,${analytics.totalEvents}`,
    `kpi,containment_rate,${analytics.containmentRate}`,
    `kpi,avg_risk,${analytics.avgRisk}`,
    `kpi,max_risk,${analytics.maxRisk}`,
    `kpi,defense_score,${analytics.defenseScore}`,
    ...analytics.severitySlices.map((s) => `severity,${s.key},${s.value}`),
    ...analytics.actionSlices.map((s) => `action,${s.key},${s.value}`),
    ...analytics.topTools.map((t) => `tool,${t.name},${t.count}`),
    ...analytics.topAgents.map((a) => `agent,${a.name},${a.count}`),
  ];
  return lines.join("\n");
}
