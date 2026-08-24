/**
 * Six fixed pipeline agent roles — single source of truth for color, label, and order.
 * Colors map to chart tokens (globals.css) for CISO-legible consistency across pages.
 */

export type PipelineAgentId =
  | "research"
  | "curator"
  | "redteam"
  | "target"
  | "judge"
  | "defender";

export type AgentOperationalStatus = "online" | "active" | "degraded" | "offline";

export interface PipelineAgentDefinition {
  id: PipelineAgentId;
  label: string;
  /** Plain-language role for executives */
  headline: string;
  description: string;
  /** Tailwind chart token index (1–6) */
  chartIndex: 1 | 2 | 3 | 4 | 5 | 6;
  /** Next agent in the closed loop (Defender → Research) */
  next: PipelineAgentId;
}

export const PIPELINE_AGENTS: PipelineAgentDefinition[] = [
  {
    id: "research",
    label: "Research",
    headline: "Threat intelligence",
    description: "Collects emerging attack patterns and maps them to OWASP Agentic categories.",
    chartIndex: 1,
    next: "curator",
  },
  {
    id: "curator",
    label: "Curator",
    headline: "Attack library",
    description: "Maintains validated templates and ASI coverage for repeatable red-team runs.",
    chartIndex: 2,
    next: "redteam",
  },
  {
    id: "redteam",
    label: "Red Team",
    headline: "Adversarial operator",
    description: "Runs multi-turn campaigns against the target using selected attack profiles.",
    chartIndex: 3,
    next: "target",
  },
  {
    id: "target",
    label: "Target",
    headline: "Agent under test",
    description: "Production-like agent with guardrails, tools, and optional RAG retrieval.",
    chartIndex: 4,
    next: "judge",
  },
  {
    id: "judge",
    label: "Judge",
    headline: "Outcome arbiter",
    description: "Scores bypass depth and produces pass/fail reasoning for each turn.",
    chartIndex: 5,
    next: "defender",
  },
  {
    id: "defender",
    label: "Defender",
    headline: "Containment & policy",
    description: "Blocks escapes, promotes findings into playbook rules, and closes the loop.",
    chartIndex: 6,
    next: "research",
  },
];

export const PIPELINE_AGENT_BY_ID: Record<PipelineAgentId, PipelineAgentDefinition> =
  Object.fromEntries(PIPELINE_AGENTS.map((a) => [a.id, a])) as Record<
    PipelineAgentId,
    PipelineAgentDefinition
  >;

/** CSS class for role accent (dot / border) — pairs with `.agent-role-*` in globals.css */
export function agentRoleClass(id: PipelineAgentId): string {
  return `agent-role-${id}`;
}

export function agentChartClass(id: PipelineAgentId): string {
  const idx = PIPELINE_AGENT_BY_ID[id].chartIndex;
  return `text-chart-${idx}`;
}

export function statusLabel(status: AgentOperationalStatus): string {
  switch (status) {
    case "online":
      return "Online";
    case "active":
      return "Active";
    case "degraded":
      return "Degraded";
    case "offline":
      return "Offline";
  }
}
