/** Mission graph projections for timestamped backend telemetry records. */

export type AgentStatus = "unknown" | "nominal" | "under_attack" | "compromised";
export type AgentEventType =
  | "event"
  | "message"
  | "status_change"
  | "finding"
  | "attack_start"
  | "attack_end";
export type AgentSeverity = "info" | "low" | "warning" | "medium" | "high" | "critical" | "unclassified";
export type CommandTimeWindow = "5m" | "15m" | "1h";

export type AgentEvent = {
  type: AgentEventType;
  timestamp: string;
  sourceAgent: string;
  targetAgent?: string;
  status?: AgentStatus;
  asiTag?: string;
  severity?: AgentSeverity;
  message: string;
  hmacValid?: boolean;
  latencyMs?: number;
  judgeVerdict?: string;
  defenderVerdict?: string;
};

export const SIX_AGENTS = [
  "Research",
  "Curator",
  "Red Team",
  "Target",
  "Judge",
  "Defender",
] as const;

export type SixAgentName = (typeof SIX_AGENTS)[number];

/** Kill-chain display order around the mission ring. */
export const AGENT_RING_ORDER: SixAgentName[] = [
  "Research",
  "Curator",
  "Red Team",
  "Target",
  "Judge",
  "Defender",
];

export const AGENT_SHORT: Record<string, string> = {
  Research: "RSH",
  Curator: "CUR",
  "Red Team": "RED",
  Target: "TGT",
  Judge: "JDG",
  Defender: "DEF",
};

export type MissionPosture = "unknown" | "nominal" | "elevated" | "critical";

export type CommandGraphNodeDatum = {
  id: string;
  name: string;
  kind: "agent" | "target";
  status: AgentStatus;
  activity: number;
};

export type CommandGraphLinkDatum = {
  source: string;
  target: string;
  traffic: number;
  hmacOk: boolean | null;
  /** Highlighted attack / containment path */
  hot?: boolean;
};

export type CommandVitals = {
  activeSimulations: number | null;
  detectionRate: number | null;
  findingsInWindow: number;
  agentUptime: number | null;
  activeAttackPaths: number | null;
  avgResponseMs: number | null;
};

export type DetectionPoint = {
  t: number;
  label: string;
  artsa: number;
  baseline: number;
};

export function windowMs(w: CommandTimeWindow): number {
  if (w === "5m") return 5 * 60_000;
  if (w === "15m") return 15 * 60_000;
  return 60 * 60_000;
}

export function filterEventsByWindow(
  events: AgentEvent[],
  window: CommandTimeWindow,
  now = Date.now()
): AgentEvent[] {
  const cut = now - windowMs(window);
  return events.filter((e) => {
    const timestamp = Date.parse(e.timestamp);
    return Number.isFinite(timestamp) && timestamp >= cut;
  });
}

export function deriveAgentStatuses(events: AgentEvent[]): Record<string, AgentStatus> {
  const status: Record<string, AgentStatus> = Object.fromEntries(
    SIX_AGENTS.map((a) => [a, "unknown" as AgentStatus])
  );
  for (const e of events) {
    if (e.status && e.sourceAgent) status[e.sourceAgent] = e.status;
    if (e.type === "attack_start" && e.targetAgent) {
      status[e.targetAgent] = status[e.targetAgent] === "compromised" ? "compromised" : "under_attack";
    }
    if (e.type === "attack_end" && e.targetAgent && status[e.targetAgent] === "under_attack") {
      status[e.targetAgent] = "unknown";
    }
  }
  return status;
}

export function deriveMissionPosture(events: AgentEvent[]): {
  posture: MissionPosture;
  headline: string;
} {
  const status = deriveAgentStatuses(events);
  const compromised = Object.values(status).filter((s) => s === "compromised").length;
  const under = Object.values(status).filter((s) => s === "under_attack").length;
  const critFindings = events.filter((e) => e.severity === "critical").length;
  if (compromised > 0 || critFindings > 0) {
    return {
      posture: "critical",
      headline: `${compromised || critFindings} critical signal${
        compromised + critFindings === 1 ? "" : "s"
      } — contain before expanding the hunt.`,
    };
  }
  if (under > 0) {
    return {
      posture: "elevated",
      headline: `${under} agent${under === 1 ? "" : "s"} under attack — inspect the wired Target / Judge path.`,
    };
  }
  const allAgentsNominal = SIX_AGENTS.every((agent) => status[agent] === "nominal");
  if (!allAgentsNominal) {
    return {
      posture: "unknown",
      headline: "Complete agent posture is unavailable in the loaded telemetry window.",
    };
  }
  return {
    posture: "nominal",
    headline: "All six agent statuses were reported nominal in the loaded telemetry window.",
  };
}

export function deriveGraphModel(
  events: AgentEvent[],
  agentFilter: string | "all",
  severityFloor: AgentSeverity | "all"
): { nodes: CommandGraphNodeDatum[]; links: CommandGraphLinkDatum[] } {
  const status = deriveAgentStatuses(events);
  const activity = new Map<string, number>();
  const traffic = new Map<string, { count: number; bad: number; verified: number }>();
  const targets = new Set<string>();

  const sevRank = { info: 0, low: 0, warning: 1, medium: 2, high: 3, critical: 4, unclassified: -1 } as const;
  const floor = severityFloor === "all" ? -1 : sevRank[severityFloor];

  for (const e of events) {
    if (severityFloor !== "all" && (e.severity == null || sevRank[e.severity] < floor)) continue;
    if (agentFilter !== "all" && e.sourceAgent !== agentFilter && e.targetAgent !== agentFilter) {
      continue;
    }
    activity.set(e.sourceAgent, (activity.get(e.sourceAgent) ?? 0) + 1);
    if (e.targetAgent) {
      activity.set(e.targetAgent, (activity.get(e.targetAgent) ?? 0) + 1);
      const key = `${e.sourceAgent}→${e.targetAgent}`;
      const row = traffic.get(key) ?? { count: 0, bad: 0, verified: 0 };
      row.count += 1;
      if (e.hmacValid === false) row.bad += 1;
      if (e.hmacValid != null) row.verified += 1;
      traffic.set(key, row);
      if (!SIX_AGENTS.includes(e.targetAgent as SixAgentName) && e.targetAgent.startsWith("TGT-")) {
        targets.add(e.targetAgent);
      }
    }
  }

  const nodes: CommandGraphNodeDatum[] = SIX_AGENTS.map((name) => ({
    id: name,
    name,
    kind: "agent",
    status: status[name] ?? "unknown",
    activity: activity.get(name) ?? 0,
  }));

  for (const [id, count] of activity) {
    if (SIX_AGENTS.includes(id as SixAgentName) || targets.has(id)) continue;
    nodes.push({ id, name: id, kind: "agent", status: status[id] ?? "unknown", activity: count });
  }

  for (const id of targets) {
    nodes.push({
      id,
      name: id,
      kind: "target",
      status: status[id] ?? "unknown",
      activity: activity.get(id) ?? 0,
    });
  }

  const links: CommandGraphLinkDatum[] = [];
  const hotAgents = new Set(
    Object.entries(status)
      .filter(([, s]) => s !== "nominal")
      .filter(([, s]) => s === "under_attack" || s === "compromised")
      .map(([id]) => id)
  );
  for (const [key, row] of traffic) {
    const [source, target] = key.split("→");
    if (!source || !target) continue;
    const onHotPath =
      hotAgents.size > 0 &&
      (hotAgents.has(source) || hotAgents.has(target));
    links.push({
      source,
      target,
      traffic: row.count,
      hmacOk: row.verified > 0 ? row.bad === 0 : null,
      hot: onHotPath,
    });
  }

  return { nodes, links };
}

/** The event stream lacks the denominator and detector outcome needed for this rate. */
export function computeDetectionRate(events: AgentEvent[]): null {
  void events;
  return null;
}

export function deriveVitals(events: AgentEvent[], now = Date.now()): CommandVitals {
  const windowStart = now - windowMs("15m");
  const inWindow = events.filter((e) => Date.parse(e.timestamp) >= windowStart);
  const findings = inWindow.filter((e) => e.type === "finding");
  const status = deriveAgentStatuses(inWindow);
  const activePaths = Object.values(status).filter((s) => s === "under_attack").length;
  const latencies = inWindow
    .map((event) => event.latencyMs)
    .filter((value): value is number => value != null && Number.isFinite(value) && value >= 0);

  return {
    activeSimulations: null,
    detectionRate: null,
    findingsInWindow: findings.length,
    agentUptime: null,
    activeAttackPaths: inWindow.length > 0 ? activePaths : null,
    avgResponseMs:
      latencies.length > 0
        ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length)
        : null,
  };
}

export function deriveDetectionSeries(events: AgentEvent[], now = Date.now()): DetectionPoint[] {
  void events;
  void now;
  // No backend history endpoint is wired into this view, and event rows alone
  // cannot supply an adaptive rate or a static comparison baseline.
  return [];
}

/** Hop keys that should pulse right now (recent message / finding traffic). */
export function recentActiveHops(events: AgentEvent[], limit = 10, maxAgeMs = 8_000): Set<string> {
  const now = Date.now();
  const keys = new Set<string>();
  for (const e of events) {
    if (keys.size >= limit) break;
    if (!e.targetAgent) continue;
    if (now - Date.parse(e.timestamp) > maxAgeMs) continue;
    keys.add(`${e.sourceAgent}→${e.targetAgent}`);
  }
  return keys;
}

export function agentMessages(events: AgentEvent[], agentId: string, limit = 12): AgentEvent[] {
  return events
    .filter((e) => e.sourceAgent === agentId || e.targetAgent === agentId)
    .slice(0, limit);
}

export function statusColor(status: AgentStatus): string {
  if (status === "unknown") return "#71717a";
  if (status === "compromised") return "#ef4444";
  if (status === "under_attack") return "#f59e0b";
  return "#22c55e";
}

export function severityColor(sev: AgentSeverity | undefined): string {
  if (sev == null || sev === "unclassified") return "#71717a";
  if (sev === "critical" || sev === "high") return "#ef4444";
  if (sev === "warning" || sev === "medium") return "#f59e0b";
  return "#22c55e";
}

/** Map Command Center / ingest telemetry rows into the AgentEvent contract. */
export function telemetryToAgentEvents(
  rows: Array<Record<string, unknown>>
): AgentEvent[] {
  return rows.flatMap((evt) => {
    const timestamp = firstString(evt, ["timestamp", "triggered_at"]);
    if (!timestamp || !Number.isFinite(Date.parse(timestamp))) return [];

    const sourceAgent = normalizeAgentName(
      firstString(evt, ["source_agent", "sourceAgent", "agent_id", "agentId", "actor"])
    );
    const rawTarget = firstString(evt, ["target_agent", "targetAgent", "to_agent", "toAgent"]);
    const targetAgent = rawTarget ? normalizeAgentName(rawTarget) : undefined;
    const type = normalizeEventType(firstString(evt, ["type", "event_type", "eventType", "kind"]));
    const severity = normalizeSeverity(firstString(evt, ["severity"]));
    const status = normalizeStatus(firstString(evt, ["status", "agent_status"]));
    const message = firstString(evt, ["message", "summary", "payload", "reason"]);
    const asiTag = firstString(evt, ["asi_tag", "asiTag"]);
    const rawLatency = Number(evt.latency_ms ?? evt.latencyMs);
    const latencyMs = Number.isFinite(rawLatency) && rawLatency >= 0 ? rawLatency : undefined;
    const hmacValue = evt.hmac_valid ?? evt.hmac_verified ?? evt.hmacValid;
    const judgeVerdict = firstString(evt, ["judge_verdict", "judgeVerdict"]);
    const defenderVerdict = firstString(evt, ["defender_verdict", "defenderVerdict"]);

    return [{
      type,
      timestamp,
      sourceAgent,
      ...(targetAgent ? { targetAgent } : {}),
      ...(status ? { status } : {}),
      ...(asiTag ? { asiTag } : {}),
      ...(severity ? { severity } : {}),
      message: message ?? "Event recorded without a summary.",
      ...(typeof hmacValue === "boolean" ? { hmacValid: hmacValue } : {}),
      ...(latencyMs != null ? { latencyMs } : {}),
      ...(judgeVerdict ? { judgeVerdict } : {}),
      ...(defenderVerdict ? { defenderVerdict } : {}),
    }];
  });
}

function firstString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function normalizeAgentName(value: string | undefined): string {
  if (!value) return "Unattributed";
  const token = value.toLowerCase().replace(/[\s-]+/g, "_");
  const canonical: Record<string, SixAgentName> = {
    research: "Research",
    curator: "Curator",
    red_team: "Red Team",
    target: "Target",
    judge: "Judge",
    defender: "Defender",
  };
  return canonical[token] ?? value;
}

function normalizeEventType(value: string | undefined): AgentEventType {
  const type = value?.toLowerCase().replace(/[\s-]+/g, "_");
  if (
    type === "message" || type === "status_change" || type === "finding" ||
    type === "attack_start" || type === "attack_end"
  ) return type;
  return "event";
}

function normalizeSeverity(value: string | undefined): AgentSeverity | undefined {
  const severity = value?.toLowerCase();
  if (
    severity === "info" || severity === "low" || severity === "warning" ||
    severity === "medium" || severity === "high" || severity === "critical"
  ) return severity;
  return severity ? "unclassified" : undefined;
}

function normalizeStatus(value: string | undefined): AgentStatus | undefined {
  const status = value?.toLowerCase().replace(/[\s-]+/g, "_");
  if (status === "nominal" || status === "under_attack" || status === "compromised") {
    return status;
  }
  return undefined;
}
