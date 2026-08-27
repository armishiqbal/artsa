/** Map Command Center ingest telemetry → Red Team Live Monitor shapes. */

import {
  detectionRateFromEvents,
  idleAgents,
  type LiveAgentName,
  type LiveAgentState,
  type LiveMonitorEvent,
  type LiveOutcome,
} from "@/lib/liveMonitorEvents";

const LIVE_FEED_ID = "live-ingest";

function verdictToOutcome(verdict: string, risk: number): LiveOutcome {
  const v = verdict.toUpperCase();
  if (v.includes("BREACH") || v === "KILL" || risk >= 80) return "fail";
  if (v.includes("SAFE") || v === "NONE" || risk < 40) return "pass";
  return "flag";
}

function actorFromTelemetry(evt: Record<string, unknown>): string {
  const tool = String(evt.tool_name ?? "").toLowerCase();
  if (tool === "user_prompt" || tool.includes("prompt")) return "red_team";
  if (tool === "model_output") return "target";
  if (tool.includes("exec") || tool.includes("shell") || tool.includes("command")) return "target";
  return String(evt.agent_id ?? "agent");
}

/** Convert live telemetry rows into Live Monitor stream events (newest first input OK). */
export function telemetryToLiveMonitorEvents(
  events: Array<Record<string, unknown>>
): LiveMonitorEvent[] {
  // Oldest → newest for seq; UI stream usually shows newest first via reverse display
  const chronological = [...events].reverse();
  return chronological.map((evt, i) => {
    const risk = Number(evt.risk_score ?? 0);
    const verdict = String(evt.verdict ?? evt.action ?? "");
    const tool = String(evt.tool_name ?? "tool");
    const agent = String(evt.agent_id ?? "agent");
    const outcome = verdictToOutcome(verdict, risk);
    const ts = String(evt.timestamp ?? evt.triggered_at ?? new Date().toISOString());
    return {
      type: "campaign_live",
      campaign_id: LIVE_FEED_ID,
      seq: i + 1,
      ts,
      kind: "verdict" as const,
      outcome,
      actor: actorFromTelemetry(evt),
      round: i + 1,
      attack_type: tool,
      summary: `${agent} · ${tool} · ${verdict || "SCAN"} · R${Math.round(risk)}`,
      campaign_status: "LIVE",
    };
  });
}

/** Newest-first view for the event list. */
export function liveIngestStreamNewestFirst(
  events: Array<Record<string, unknown>>
): LiveMonitorEvent[] {
  return telemetryToLiveMonitorEvents(events).reverse();
}

export function agentsFromTelemetry(
  events: Array<Record<string, unknown>>
): Record<LiveAgentName, LiveAgentState> {
  const agents = idleAgents();
  if (!events.length) return agents;

  const latest = events[0]!;
  const risk = Number(latest.risk_score ?? 0);
  const verdict = String(latest.verdict ?? "").toUpperCase();
  const hot = risk >= 60 || verdict.includes("BREACH");

  agents.red_team = "done";
  agents.target = "done";
  agents.judge = "done";
  agents.defender = hot ? "running" : "done";
  agents.research = "idle";
  agents.curator = "idle";
  return agents;
}

export function ingestDetectionStats(events: Array<Record<string, unknown>>) {
  const mapped = telemetryToLiveMonitorEvents(events);
  const base = detectionRateFromEvents(mapped);
  // For ingest: "pass" = contained/safe; invert naming for ops clarity as detect%
  const fails = mapped.filter((e) => e.outcome === "fail").length;
  const judged = mapped.filter((e) => e.outcome).length;
  const detectPct = judged > 0 ? Math.round((fails / judged) * 1000) / 10 : null;
  const riskSpark = events
    .slice(0, 24)
    .map((e) => Number(e.risk_score ?? 0))
    .reverse();
  return {
    ...base,
    detectPct,
    fails,
    riskSpark,
    total: events.length,
  };
}

export function severityBuckets(events: Array<Record<string, unknown>>) {
  const buckets = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const e of events) {
    const sev = String(e.severity ?? "").toUpperCase();
    const risk = Number(e.risk_score ?? 0);
    if (sev === "CRITICAL" || risk >= 80) buckets.CRITICAL += 1;
    else if (sev === "HIGH" || risk >= 60) buckets.HIGH += 1;
    else if (sev === "MEDIUM" || risk >= 40) buckets.MEDIUM += 1;
    else buckets.LOW += 1;
  }
  return buckets;
}

export type LiveAiActivityModel = {
  riskSeries: Array<{ i: number; label: string; risk: number; critical: number }>;
  tools: Array<{ tool: string; count: number; maxRisk: number }>;
  agents: Array<{ agent: string; count: number; maxRisk: number }>;
  detectors: Array<{ name: string; hits: number }>;
  pipeline: Array<{
    id: string;
    label: string;
    detail: string;
    active: boolean;
    hot: boolean;
  }>;
  latest: Record<string, unknown> | null;
};

/** Full AI activity model for live visualization panels. */
export function buildLiveAiActivity(
  events: Array<Record<string, unknown>>
): LiveAiActivityModel {
  const chronological = [...events].reverse();
  const riskSeries = chronological.slice(-32).map((e, i) => {
    const risk = Number(e.risk_score ?? 0);
    return {
      i: i + 1,
      label: String(i + 1),
      risk,
      critical: risk >= 80 ? risk : 0,
    };
  });

  const toolMap = new Map<string, { count: number; maxRisk: number }>();
  const agentMap = new Map<string, { count: number; maxRisk: number }>();
  const detectorMap = new Map<string, number>();

  for (const e of events) {
    const tool = String(e.tool_name ?? "unknown");
    const agent = String(e.agent_id ?? "unknown");
    const risk = Number(e.risk_score ?? 0);
    const t = toolMap.get(tool) ?? { count: 0, maxRisk: 0 };
    toolMap.set(tool, { count: t.count + 1, maxRisk: Math.max(t.maxRisk, risk) });
    const a = agentMap.get(agent) ?? { count: 0, maxRisk: 0 };
    agentMap.set(agent, { count: a.count + 1, maxRisk: Math.max(a.maxRisk, risk) });

    const dets = e.detectors;
    if (Array.isArray(dets)) {
      for (const d of dets) {
        const name = String(d).replace(/Detector$/i, "");
        detectorMap.set(name, (detectorMap.get(name) ?? 0) + 1);
      }
    }
    const sec = e.security_events;
    if (Array.isArray(sec)) {
      for (const s of sec) {
        if (s && typeof s === "object" && "detector" in s) {
          const name = String((s as { detector: unknown }).detector).replace(/Detector$/i, "");
          detectorMap.set(name, (detectorMap.get(name) ?? 0) + 1);
        }
      }
    }
  }

  const tools = [...toolMap.entries()]
    .map(([tool, meta]) => ({ tool, ...meta }))
    .sort((a, b) => b.count - a.count || b.maxRisk - a.maxRisk)
    .slice(0, 8);
  const agents = [...agentMap.entries()]
    .map(([agent, meta]) => ({ agent, ...meta }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  const detectors = [...detectorMap.entries()]
    .map(([name, hits]) => ({ name, hits }))
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 8);

  const latest = events[0] ?? null;
  const risk = Number(latest?.risk_score ?? 0);
  const verdict = String(latest?.verdict ?? "—");
  const tool = String(latest?.tool_name ?? "—");
  const agent = String(latest?.agent_id ?? "—");
  const action = String(latest?.action ?? latest?.recommended_action ?? "NONE");
  const hot = risk >= 60 || verdict.toUpperCase().includes("BREACH");
  const dets = Array.isArray(latest?.detectors)
    ? (latest!.detectors as unknown[]).map(String).slice(0, 3).join(", ")
    : "—";

  const pipeline = [
    {
      id: "prompt",
      label: "AI input",
      detail: tool,
      active: Boolean(latest),
      hot: false,
    },
    {
      id: "agent",
      label: "Agent",
      detail: agent,
      active: Boolean(latest),
      hot: false,
    },
    {
      id: "detect",
      label: "Detectors",
      detail: dets || "scanning",
      active: Boolean(latest),
      hot,
    },
    {
      id: "verdict",
      label: "Verdict",
      detail: `${verdict} · R${Math.round(risk)}`,
      active: Boolean(latest),
      hot,
    },
    {
      id: "action",
      label: "Action",
      detail: action,
      active: Boolean(latest),
      hot: action.toUpperCase() === "KILL" || action.toUpperCase() === "QUARANTINE",
    },
  ];

  return { riskSeries, tools, agents, detectors, pipeline, latest };
}

export { LIVE_FEED_ID };
