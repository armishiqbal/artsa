/**
 * Command Center mission graph — derive nodes/edges from topology API,
 * live telemetry, or the control-plane pipeline fallback.
 */

export type CommandNodeKind = "session" | "agent" | "tool" | "control";
export type CommandNodeSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "SAFE";
export type CommandEdgeStatus = "COMPROMISED" | "QUARANTINED" | "SAFE" | "ACTIVE";

export interface CommandGraphNode {
  id: string;
  label: string;
  kind: CommandNodeKind;
  severity: CommandNodeSeverity;
  riskScore: number;
  status: string;
  eventCount: number;
  sessionId?: string;
  x: number;
  y: number;
}

export interface CommandGraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  status: CommandEdgeStatus;
  count: number;
}

export interface CommandGraphModel {
  nodes: CommandGraphNode[];
  edges: CommandGraphEdge[];
  source: "topology" | "telemetry" | "control_plane";
  compromisedCount: number;
  activeCount: number;
}

export interface TopologyApiPayload {
  nodes?: Array<{
    id: string;
    label: string;
    type?: string;
    risk_score?: number;
    status?: string;
  }>;
  edges?: Array<{
    source: string;
    target: string;
    type?: string;
  }>;
}

type LiveEventLike = Record<string, unknown>;

const VIEW_W = 960;
const VIEW_H = 520;

function scoreToSeverity(score: number, status?: string): CommandNodeSeverity {
  const s = (status ?? "").toUpperCase();
  if (s.includes("BREACH") || s.includes("COMPROMISE") || s === "KILL") return "CRITICAL";
  if (s.includes("QUARANTINE") || s === "ESCALATED") return "HIGH";
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 40) return "MEDIUM";
  if (score >= 20) return "LOW";
  return "SAFE";
}

function edgeStatusFromRisk(score: number, verdict?: string): CommandEdgeStatus {
  const v = (verdict ?? "").toUpperCase();
  if (v.includes("BREACH") || score >= 80) return "COMPROMISED";
  if (v.includes("QUARANTINE") || v === "SUSPICIOUS" || score >= 50) return "QUARANTINED";
  if (score > 0) return "ACTIVE";
  return "SAFE";
}

/** Deterministic radial/ring layout — stable across renders. */
export function layoutNodes(
  count: number,
  width = VIEW_W,
  height = VIEW_H
): Array<{ x: number; y: number }> {
  if (count <= 0) return [];
  if (count === 1) return [{ x: width / 2, y: height / 2 }];

  const cx = width / 2;
  const cy = height / 2;
  const cols = Math.min(5, Math.ceil(Math.sqrt(count)));
  const rows = Math.ceil(count / cols);
  const gapX = Math.min(180, (width - 120) / Math.max(cols, 1));
  const gapY = Math.min(140, (height - 100) / Math.max(rows, 1));
  const originX = cx - ((cols - 1) * gapX) / 2;
  const originY = cy - ((rows - 1) * gapY) / 2;

  return Array.from({ length: count }, (_, i) => ({
    x: originX + (i % cols) * gapX,
    y: originY + Math.floor(i / cols) * gapY,
  }));
}

function applyLayout<T extends { id: string }>(
  items: T[]
): Array<T & { x: number; y: number }> {
  const positions = layoutNodes(items.length);
  return items.map((item, i) => ({ ...item, ...positions[i]! }));
}

export function buildGraphFromTopology(payload: TopologyApiPayload): CommandGraphModel | null {
  const rawNodes = payload.nodes ?? [];
  if (!rawNodes.length) return null;

  const positioned = applyLayout(
    rawNodes.map((n) => {
      const risk = Number(n.risk_score ?? 0);
      const kind: CommandNodeKind =
        n.type === "tool"
          ? "tool"
          : n.type === "session"
            ? "session"
            : "agent";
      return {
        id: String(n.id),
        label: String(n.label || n.id),
        kind,
        severity: scoreToSeverity(risk, n.status),
        riskScore: risk,
        status: String(n.status ?? "ACTIVE"),
        eventCount: 1,
        sessionId: n.type === "session" ? String(n.id) : undefined,
      };
    })
  );

  const edges: CommandGraphEdge[] = (payload.edges ?? []).map((e, i) => ({
    id: `topo-e${i}`,
    source: String(e.source),
    target: String(e.target),
    label: String(e.type ?? "call"),
    status: "ACTIVE" as const,
    count: 1,
  }));

  // Elevate edge status from connected node risk
  const byId = new Map(positioned.map((n) => [n.id, n]));
  for (const edge of edges) {
    const src = byId.get(edge.source);
    const tgt = byId.get(edge.target);
    const maxRisk = Math.max(src?.riskScore ?? 0, tgt?.riskScore ?? 0);
    edge.status = edgeStatusFromRisk(maxRisk, src?.status ?? tgt?.status);
  }

  return finalize(positioned, edges, "topology");
}

export function buildGraphFromTelemetry(events: LiveEventLike[]): CommandGraphModel | null {
  if (!events.length) return null;

  const agentMap = new Map<
    string,
    { risk: number; count: number; status: string; sessionId?: string }
  >();
  const toolMap = new Map<string, { risk: number; count: number; status: string }>();
  const linkMap = new Map<string, { count: number; risk: number; verdict: string; label: string }>();

  for (const evt of events) {
    const agentId = String(evt.agent_id ?? "").trim() || "unknown-agent";
    const toolName = String(evt.tool_name ?? "").trim();
    const risk = Number(evt.risk_score ?? 0);
    const verdict = String(evt.verdict ?? evt.action ?? "");
    const sessionId = evt.session_id != null ? String(evt.session_id) : undefined;

    const prev = agentMap.get(agentId) ?? { risk: 0, count: 0, status: "ACTIVE", sessionId };
    agentMap.set(agentId, {
      risk: Math.max(prev.risk, risk),
      count: prev.count + 1,
      status: risk >= prev.risk ? verdict || prev.status : prev.status,
      sessionId: sessionId ?? prev.sessionId,
    });

    if (toolName && toolName !== "session") {
      const tPrev = toolMap.get(toolName) ?? { risk: 0, count: 0, status: "ACTIVE" };
      toolMap.set(toolName, {
        risk: Math.max(tPrev.risk, risk),
        count: tPrev.count + 1,
        status: risk >= tPrev.risk ? verdict || tPrev.status : tPrev.status,
      });
      const linkKey = `${agentId}→${toolName}`;
      const lPrev = linkMap.get(linkKey) ?? { count: 0, risk: 0, verdict: "", label: toolName };
      linkMap.set(linkKey, {
        count: lPrev.count + 1,
        risk: Math.max(lPrev.risk, risk),
        verdict: risk >= lPrev.risk ? verdict : lPrev.verdict,
        label: toolName,
      });
    }
  }

  const rawNodes: Omit<CommandGraphNode, "x" | "y">[] = [];
  for (const [id, meta] of agentMap) {
    rawNodes.push({
      id: `agent-${id}`,
      label: id,
      kind: "agent",
      severity: scoreToSeverity(meta.risk, meta.status),
      riskScore: meta.risk,
      status: meta.status || "ACTIVE",
      eventCount: meta.count,
      sessionId: meta.sessionId,
    });
  }
  for (const [name, meta] of toolMap) {
    rawNodes.push({
      id: `tool-${name}`,
      label: name,
      kind: "tool",
      severity: scoreToSeverity(meta.risk, meta.status),
      riskScore: meta.risk,
      status: meta.status || "ACTIVE",
      eventCount: meta.count,
    });
  }

  const positioned = applyLayout(rawNodes);
  const edges: CommandGraphEdge[] = [];
  let i = 0;
  for (const [key, meta] of linkMap) {
    const [agentId, toolName] = key.split("→");
    edges.push({
      id: `tel-e${i++}`,
      source: `agent-${agentId}`,
      target: `tool-${toolName}`,
      label: meta.label,
      status: edgeStatusFromRisk(meta.risk, meta.verdict),
      count: meta.count,
    });
  }

  return finalize(positioned, edges, "telemetry");
}

/** Six-role control plane when no live topology/telemetry yet. */
export function buildControlPlaneGraph(
  agents: Array<{ id: string; label: string; status: string }>
): CommandGraphModel {
  const n = agents.length || 6;
  const cx = VIEW_W / 2;
  const cy = VIEW_H / 2;
  const r = 170;
  const fallback = [
    { id: "research", label: "Research" },
    { id: "curator", label: "Curator" },
    { id: "redteam", label: "Red Team" },
    { id: "target", label: "Target" },
    { id: "judge", label: "Judge" },
    { id: "defender", label: "Defender" },
  ];
  const list = agents.length
    ? agents
    : fallback.map((f) => ({ ...f, status: "offline" }));

  const nodes: CommandGraphNode[] = list.map((a, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const hot = a.status === "alert" || a.status === "degraded";
    return {
      id: `ctrl-${a.id}`,
      label: a.label,
      kind: "control",
      severity: hot ? "HIGH" : a.status === "online" ? "SAFE" : "LOW",
      riskScore: hot ? 55 : a.status === "online" ? 10 : 0,
      status: a.status,
      eventCount: 0,
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
    };
  });

  const edges: CommandGraphEdge[] = nodes.map((node, i) => {
    const next = nodes[(i + 1) % nodes.length]!;
    return {
      id: `ctrl-e${i}`,
      source: node.id,
      target: next.id,
      label: "handoff",
      status: "SAFE",
      count: 1,
    };
  });

  return finalize(nodes, edges, "control_plane");
}

function finalize(
  nodes: CommandGraphNode[],
  edges: CommandGraphEdge[],
  source: CommandGraphModel["source"]
): CommandGraphModel {
  const compromisedCount = nodes.filter(
    (n) => n.severity === "CRITICAL" || n.severity === "HIGH"
  ).length;
  const activeCount = nodes.filter((n) => n.kind !== "control" || n.riskScore > 0).length;
  return { nodes, edges, source, compromisedCount, activeCount };
}

export function deriveCommandGraph(input: {
  topology: TopologyApiPayload | null;
  events: LiveEventLike[];
  controlAgents?: Array<{ id: string; label: string; status: string }>;
}): CommandGraphModel {
  const fromTopo = input.topology ? buildGraphFromTopology(input.topology) : null;
  if (fromTopo) return fromTopo;
  const fromTel = buildGraphFromTelemetry(input.events);
  if (fromTel) return fromTel;
  return buildControlPlaneGraph(input.controlAgents ?? []);
}

export const COMMAND_GRAPH_VIEW = { width: VIEW_W, height: VIEW_H } as const;

export function severityStroke(severity: CommandNodeSeverity): string {
  switch (severity) {
    case "CRITICAL":
      return "hsl(var(--severity-critical))";
    case "HIGH":
      return "hsl(var(--severity-high))";
    case "MEDIUM":
      return "hsl(var(--severity-medium))";
    case "LOW":
      return "hsl(var(--severity-low))";
    default:
      return "hsl(var(--border))";
  }
}

export function edgeStroke(status: CommandEdgeStatus): string {
  switch (status) {
    case "COMPROMISED":
      return "hsl(var(--severity-critical))";
    case "QUARANTINED":
      return "hsl(var(--severity-high))";
    case "ACTIVE":
      return "hsl(var(--primary))";
    default:
      return "hsl(var(--border))";
  }
}
