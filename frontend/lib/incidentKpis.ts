/**
 * Incident KPIs derived from LIVE platform metrics and telemetry only.
 *
 * No simulated data. When there is nothing ingested yet, counts are zero and
 * the UI shows honest empty states.
 */

export interface IncidentKpis {
  blocked_prompt_injections: number;
  tool_misuse_events: number;
  policy_violations: number;
  /** 0–100; lower is healthier. */
  provider_risk_score: number;
}

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
 * Returns real counts (possibly zero) — never fabricated numbers.
 */
export function deriveIncidentKpis(
  metrics: DashboardMetricsLike | null,
  liveEvents: LiveEventLike[]
): IncidentKpis {
  const injectionEvents = liveEvents.filter(isInjection);
  const misuseEvents = liveEvents.filter(isToolMisuse);
  const policyEvents = liveEvents.filter(isPolicyViolation);

  const riskScores = liveEvents
    .map((e) => Number(e.risk_score ?? 0))
    .filter((n) => Number.isFinite(n) && n > 0);
  const providerRisk =
    riskScores.length > 0
      ? Math.round(riskScores.reduce((a, b) => a + b, 0) / riskScores.length)
      : Number(metrics?.avg_risk_score ?? 0);

  return {
    blocked_prompt_injections: injectionEvents.filter(isBlocked).length,
    tool_misuse_events: misuseEvents.filter(isBlocked).length,
    policy_violations: policyEvents.filter(isBlocked).length,
    provider_risk_score: Number.isFinite(providerRisk) ? Math.round(providerRisk) : 0,
  };
}
