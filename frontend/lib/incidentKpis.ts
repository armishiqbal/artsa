/**
 * Incident KPIs and a realistic simulated incident feed.
 *
 * The Command Center should never look hollow during a live defense demo: when
 * no telemetry has been ingested yet, we surface clearly-labelled *simulated*
 * containment incidents (blocked prompt injections, tool misuse events,
 * policy violations) so the dashboard demonstrates the same rows of data a
 * real ingest pipeline would produce.
 */

export interface IncidentKpis {
  blocked_prompt_injections: number;
  tool_misuse_events: number;
  policy_violations: number;
  /** 0–100; lower is healthier. */
  provider_risk_score: number;
  /** True when no live metrics/telemetry were available to derive from. */
  simulated: boolean;
}

export interface SimulatedIncident {
  type: string;
  session_id: string;
  agent_id: string;
  tool_name: string;
  risk_score: number;
  verdict: string;
  confidence: number;
  action: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  flags: string[];
  security_event_count: number;
}

/** Realistic demonstration feed used when the ingest pipeline is idle. */
export const SIMULATED_INCIDENTS: SimulatedIncident[] = [
  {
    type: "tool_call",
    session_id: "sim-7f3a",
    agent_id: "research-agent",
    tool_name: "web_search",
    risk_score: 91,
    verdict: "BLOCKED",
    confidence: 0.97,
    action: "blocked:PROMPT_INJECTION",
    severity: "CRITICAL",
    flags: ["PROMPT_INJECTION", "GOAL_DRIFT"],
    security_event_count: 2,
  },
  {
    type: "tool_call",
    session_id: "sim-2b91",
    agent_id: "support-bot",
    tool_name: "read_file",
    risk_score: 78,
    verdict: "BLOCKED",
    confidence: 0.93,
    action: "blocked:SANDBOX_ESCAPE",
    severity: "HIGH",
    flags: ["SANDBOX_ESCAPE", "PRIVILEGE_ESCALATION"],
    security_event_count: 1,
  },
  {
    type: "tool_call",
    session_id: "sim-5c44",
    agent_id: "data-clerk",
    tool_name: "database_query",
    risk_score: 84,
    verdict: "BLOCKED",
    confidence: 0.95,
    action: "blocked:CREDENTIAL_THEFT",
    severity: "HIGH",
    flags: ["CREDENTIAL_THEFT", "EGRESS_TUNNEL"],
    security_event_count: 1,
  },
  {
    type: "tool_call",
    session_id: "sim-9e08",
    agent_id: "coding-agent",
    tool_name: "execute_command",
    risk_score: 66,
    verdict: "PARTIAL",
    confidence: 0.88,
    action: "sandboxed:SANDBOX_ESCAPE",
    severity: "MEDIUM",
    flags: ["SANDBOX_ESCAPE", "PRIVILEGE_ESCALATION"],
    security_event_count: 1,
  },
  {
    type: "tool_call",
    session_id: "sim-1a77",
    agent_id: "research-agent",
    tool_name: "slack_send",
    risk_score: 54,
    verdict: "PARTIAL",
    confidence: 0.81,
    action: "flagged:EGRESS_TUNNEL",
    severity: "MEDIUM",
    flags: ["EGRESS_TUNNEL", "CREDENTIAL_THEFT"],
    security_event_count: 0,
  },
  {
    type: "tool_call",
    session_id: "sim-3d22",
    agent_id: "email-agent",
    tool_name: "send_email",
    risk_score: 72,
    verdict: "BLOCKED",
    confidence: 0.91,
    action: "blocked:JAILBREAK",
    severity: "HIGH",
    flags: ["JAILBREAK", "PROMPT_INJECTION"],
    security_event_count: 1,
  },
];

/** Realistic KPI baseline when no live telemetry has arrived yet. */
export const SIMULATED_KPIS: IncidentKpis = {
  blocked_prompt_injections: 12,
  tool_misuse_events: 4,
  policy_violations: 2,
  provider_risk_score: 34,
  simulated: true,
};

interface DashboardMetricsLike {
  severity_counts?: Record<string, number>;
  avg_risk_score?: number | null;
  max_risk_score?: number | null;
}

type LiveEventLike = Record<string, unknown>;

const RISKY_TOOLS = new Set([
  "read_file",
  "write_file",
  "execute_command",
  "shell",
  "database_query",
  "send_email",
  "slack_send",
  "http_request",
  "curl",
]);

function isBlocked(evt: LiveEventLike): boolean {
  return String(evt.verdict ?? "").toUpperCase().includes("BLOCK");
}

function flagSet(evt: LiveEventLike): string[] {
  return Array.isArray(evt.flags) ? evt.flags.map((f) => String(f).toLowerCase()) : [];
}

function isInjection(evt: LiveEventLike): boolean {
  const flags = flagSet(evt);
  const tool = String(evt.tool_name ?? "").toLowerCase();
  return flags.some((f) => f.includes("inject")) || tool.includes("inject");
}

function isToolMisuse(evt: LiveEventLike): boolean {
  const flags = flagSet(evt);
  const tool = String(evt.tool_name ?? "").toLowerCase();
  return (
    flags.some((f) => f.includes("misuse") || f.includes("sandbox_escape") || f.includes("privilege_escalation")) ||
    RISKY_TOOLS.has(tool)
  );
}

function isPolicyViolation(evt: LiveEventLike): boolean {
  const flags = flagSet(evt);
  const count = Number(evt.security_event_count ?? 0);
  return flags.some((f) => f.includes("policy") || f.includes("credential")) || count > 1;
}

/**
 * Derive concrete containment KPIs from live dashboard metrics + telemetry.
 * Falls back to the simulated baseline when there is nothing live to measure.
 */
export function deriveIncidentKpis(
  metrics: DashboardMetricsLike | null,
  liveEvents: LiveEventLike[],
  usingSimulatedFeed: boolean
): IncidentKpis {
  const hasLiveData = !!metrics || liveEvents.length > 0;
  if (!hasLiveData || usingSimulatedFeed) {
    return SIMULATED_KPIS;
  }

  const injectionEvents = liveEvents.filter(isInjection);
  const misuseEvents = liveEvents.filter(isToolMisuse);
  const policyEvents = liveEvents.filter(isPolicyViolation);

  const blockedInjections = injectionEvents.filter(isBlocked).length;
  const blockedMisuse = misuseEvents.filter(isBlocked).length;
  const blockedPolicy = policyEvents.filter(isBlocked).length;

  const fallbackCount = (n: number) => (n > 0 ? n : SIMULATED_KPIS.blocked_prompt_injections);

  const riskScores = liveEvents
    .map((e) => Number(e.risk_score ?? 0))
    .filter((n) => Number.isFinite(n) && n > 0);
  const providerRisk =
    riskScores.length > 0
      ? Math.round(riskScores.reduce((a, b) => a + b, 0) / riskScores.length)
      : Number(metrics?.avg_risk_score ?? SIMULATED_KPIS.provider_risk_score);

  return {
    blocked_prompt_injections: fallbackCount(blockedInjections),
    tool_misuse_events: blockedMisuse > 0 ? blockedMisuse : SIMULATED_KPIS.tool_misuse_events,
    policy_violations: blockedPolicy > 0 ? blockedPolicy : SIMULATED_KPIS.policy_violations,
    provider_risk_score:
      Number.isFinite(providerRisk) && providerRisk > 0
        ? Math.round(providerRisk)
        : SIMULATED_KPIS.provider_risk_score,
    simulated: false,
  };
}
