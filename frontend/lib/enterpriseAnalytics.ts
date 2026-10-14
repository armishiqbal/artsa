/** Analytics derived only from explicit metrics and recorded telemetry fields. */

import type { ContainmentAction } from "@/lib/securityLog";
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
  containedCount: number | null;
  containmentRate: number | null;
  avgRisk: number | null;
  maxRisk: number | null;
  defenseScore: number | null;
  severitySlices: SeveritySlice[];
  hasSeveritySignal: boolean;
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

function optionalNumber(value: unknown, min = 0, max = 100): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

function eventTime(evt: LiveEventLike): number {
  return safeTimestamp(String(evt.triggered_at ?? evt.timestamp ?? evt.ts ?? ""));
}

function eventSeverity(evt: LiveEventLike): SeverityLabel | null {
  const raw = String(evt.severity ?? "").toUpperCase();
  if (raw === "CRITICAL" || raw === "HIGH" || raw === "MEDIUM" || raw === "LOW") return raw;
  const risk = optionalNumber(evt.risk_score);
  return risk === null ? null : severityFromScore(risk);
}

function recordedAction(evt: LiveEventLike): ContainmentAction {
  const raw = String(
    evt.enforced_action ?? evt.auto_enforced_action ?? evt.action ?? evt.recommended_action ?? ""
  ).trim().toUpperCase();
  if (["KILL", "TERMINATE"].includes(raw)) return "KILL";
  if (["QUARANTINE", "BLOCK", "DENY"].includes(raw)) return "QUARANTINE";
  if (["FLAG", "WARN"].includes(raw)) return "FLAG";
  if (["ESCALATE", "ALERT"].includes(raw)) return "ESCALATE";
  if (["ALLOW", "PERMIT"].includes(raw)) return "ALLOW";
  return "UNKNOWN";
}

function enforcementStatus(evt: LiveEventLike): boolean | null {
  if (evt.enforced_action != null || evt.auto_enforced_action != null) return true;
  return typeof evt.enforced === "boolean" ? evt.enforced : null;
}

function rankByField(
  events: LiveEventLike[],
  field: "tool_name" | "agent_id",
  limit = 8
): RankedItem[] {
  const map = new Map<string, { count: number; sum: number; max: number }>();
  for (const evt of events) {
    const risk = optionalNumber(evt.risk_score);
    if (risk === null) continue;
    const name = String(evt[field] ?? "").trim() || "unknown";
    if (field === "tool_name" && (name === "session" || name === "unknown")) continue;
    const prev = map.get(name) ?? { count: 0, sum: 0, max: 0 };
    map.set(name, { count: prev.count + 1, sum: prev.sum + risk, max: Math.max(prev.max, risk) });
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({
      name,
      count: value.count,
      avgRisk: Math.round(value.sum / value.count),
      maxRisk: Math.round(value.max),
    }))
    .sort((a, b) => b.maxRisk - a.maxRisk || b.count - a.count)
    .slice(0, limit);
}

function buildVolume(events: LiveEventLike[]): VolumeBucket[] {
  if (!events.length) return [];
  const buckets = new Map<string, VolumeBucket>();
  for (const evt of events) {
    const ts = eventTime(evt);
    const label = ts
      ? new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
      : "Time unavailable";
    const severity = eventSeverity(evt);
    const previous = buckets.get(label) ?? { label, count: 0, critical: 0, high: 0 };
    previous.count += 1;
    if (severity === "CRITICAL") previous.critical += 1;
    if (severity === "HIGH") previous.high += 1;
    buckets.set(label, previous);
  }
  return Array.from(buckets.values()).slice(-16);
}

function toRiskPoint(timestamp: string | undefined, score: number, index: number): RiskTrendPoint {
  const ts = timestamp ? safeTimestamp(timestamp) : 0;
  return {
    name: index + 1,
    label: ts
      ? new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
      : `#${index + 1}`,
    score,
    criticalLine: 80,
    highLine: 50,
  };
}

function buildRiskTrend(metrics: AnalyticsMetricsLike | null, events: LiveEventLike[]): RiskTrendPoint[] {
  const trend = (metrics?.risk_trend ?? [])
    .map((point) => ({ timestamp: point.timestamp, score: optionalNumber(point.risk_score) }))
    .filter((point): point is { timestamp: string | undefined; score: number } => point.score !== null);
  if (trend.length) return trend.map((point, index) => toRiskPoint(point.timestamp, point.score, index));

  const scoredEvents = events
    .map((event) => ({ timestamp: event.triggered_at ?? event.timestamp ?? event.ts, score: optionalNumber(event.risk_score) }))
    .filter((point): point is { timestamp: unknown; score: number } => point.score !== null)
    .map((point) => ({ timestamp: String(point.timestamp ?? ""), score: point.score, time: safeTimestamp(String(point.timestamp ?? "")) }))
    .filter((point) => point.time > 0)
    .sort((a, b) => a.time - b.time)
    .slice(-24);

  return scoredEvents.map((point, index) => toRiskPoint(point.timestamp, point.score, index));
}

export function deriveEnterpriseAnalytics(
  metrics: AnalyticsMetricsLike | null,
  liveEvents: LiveEventLike[]
): EnterpriseAnalytics {
  const counts = metrics?.severity_counts ?? {};
  const severityOrder: SeverityLabel[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
  let severityValues = severityOrder.map((key) => optionalNumber(counts[key], 0, Number.MAX_SAFE_INTEGER) ?? 0);
  let hasSeveritySignal = severityValues.some((count) => count > 0);

  if (!hasSeveritySignal && liveEvents.length) {
    const tallies: Record<SeverityLabel, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    for (const event of liveEvents) {
      const severity = eventSeverity(event);
      if (severity) tallies[severity] += 1;
    }
    severityValues = severityOrder.map((key) => tallies[key]);
    hasSeveritySignal = liveEvents.some((event) => eventSeverity(event) !== null);
  }

  const severitySlices = severityOrder.map((key, index) => ({
    key,
    label: key,
    value: severityValues[index] ?? 0,
    fill: SEVERITY_FILL[key],
  }));

  const actionTallies: Record<ContainmentAction, number> = {
    KILL: 0,
    QUARANTINE: 0,
    FLAG: 0,
    ESCALATE: 0,
    ALLOW: 0,
    UNKNOWN: 0,
  };
  for (const event of liveEvents) actionTallies[recordedAction(event)] += 1;
  const actionSlices: ActionSlice[] = (
    ["KILL", "QUARANTINE", "FLAG", "ESCALATE", "ALLOW", "UNKNOWN"] as ContainmentAction[]
  )
    .filter((key) => actionTallies[key] > 0)
    .map((key) => ({ key, label: key, value: actionTallies[key], fill: ACTION_FILL[key] ?? "#454545" }));

  let containedCount: number | null = null;
  let containmentRate: number | null = null;
  if (liveEvents.length) {
    const knownOutcomes = liveEvents.filter((event) => enforcementStatus(event) !== null);
    containedCount = knownOutcomes.filter((event) => {
      const action = recordedAction(event);
      return enforcementStatus(event) === true && (action === "KILL" || action === "QUARANTINE");
    }).length;
    if (knownOutcomes.length === liveEvents.length) {
      containmentRate = Math.round((containedCount / liveEvents.length) * 100);
    } else {
      containedCount = null;
    }
  }

  const totalEvents = Math.max(
    optionalNumber(metrics?.total_events, 0, Number.MAX_SAFE_INTEGER) ?? 0,
    liveEvents.length,
    severityValues.reduce((sum, count) => sum + count, 0)
  );
  const riskScores = liveEvents
    .map((event) => optionalNumber(event.risk_score))
    .filter((score): score is number => score !== null);
  const avgRisk = riskScores.length
    ? Math.round(riskScores.reduce((sum, score) => sum + score, 0) / riskScores.length)
    : optionalNumber(metrics?.avg_risk_score);
  const maxRisk = riskScores.length
    ? Math.round(Math.max(...riskScores))
    : optionalNumber(metrics?.max_risk_score);

  const riskTrend = buildRiskTrend(metrics, liveEvents);
  const defenseLayers = Object.entries(metrics?.defense_layers ?? {})
    .map(([key, value]) => ({
      key,
      label: LAYER_LABELS[key] ?? key.replace(/_/g, " "),
      value: optionalNumber(value),
    }))
    .filter((layer): layer is { key: string; label: string; value: number } => layer.value !== null);
  const defenseScore = optionalNumber(metrics?.defense_score);

  return {
    totalEvents,
    containedCount,
    containmentRate,
    avgRisk,
    maxRisk,
    defenseScore,
    severitySlices,
    hasSeveritySignal,
    actionSlices,
    topTools: rankByField(liveEvents, "tool_name"),
    topAgents: rankByField(liveEvents, "agent_id"),
    volume: buildVolume(liveEvents),
    riskTrend,
    defenseLayers,
    hasLiveSignal: totalEvents > 0 || riskTrend.length > 0 || liveEvents.length > 0 || defenseLayers.length > 0,
  };
}

function csvValue(value: number | null): string {
  return value === null ? "" : String(value);
}

export function analyticsBundleToCsv(analytics: EnterpriseAnalytics): string {
  const lines = [
    "section,key,value",
    `kpi,total_events,${analytics.totalEvents}`,
    `kpi,containment_rate,${csvValue(analytics.containmentRate)}`,
    `kpi,avg_risk,${csvValue(analytics.avgRisk)}`,
    `kpi,max_risk,${csvValue(analytics.maxRisk)}`,
    `kpi,defense_score,${csvValue(analytics.defenseScore)}`,
    ...analytics.severitySlices.map((slice) => `severity,${slice.key},${slice.value}`),
    ...analytics.actionSlices.map((slice) => `action,${slice.key},${slice.value}`),
    ...analytics.topTools.map((tool) => `tool,${tool.name},${tool.count}`),
    ...analytics.topAgents.map((agent) => `agent,${agent.name},${agent.count}`),
  ];
  return lines.join("\n");
}
