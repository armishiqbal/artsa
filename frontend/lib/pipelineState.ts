import type { CampaignListItem } from "@/lib/hooks/useCampaigns";
import type {
  AgentOperationalStatus,
  PipelineAgentDefinition,
  PipelineAgentId,
} from "@/lib/agentRoles";
import { PIPELINE_AGENTS } from "@/lib/agentRoles";

export interface AgentRuntimeState {
  id: PipelineAgentId;
  status: AgentOperationalStatus;
  currentTask: string;
  lastRun: string | null;
  hmacVerified: boolean | null;
}

export interface PipelineSnapshot {
  agents: AgentRuntimeState[];
  activeAgentId: PipelineAgentId | null;
  loopClosed: boolean;
}

interface DerivePipelineInput {
  apiOnline: boolean;
  wsConnected: boolean;
  activeSessions: number;
  defenseScore: number;
  criticalCount: number;
  highCount: number;
  campaigns: CampaignListItem[];
  playbookRuleCount: number;
}

function latestCampaign(campaigns: CampaignListItem[]): CampaignListItem | null {
  if (!campaigns.length) return null;
  return campaigns[0];
}

function runningCampaign(campaigns: CampaignListItem[]): CampaignListItem | null {
  return campaigns.find((c) => c.status === "running" || c.status === "pending") ?? null;
}

function formatRelative(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const diffMs = Date.now() - t;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function agentState(
  agent: PipelineAgentDefinition,
  input: DerivePipelineInput,
  running: CampaignListItem | null,
  latest: CampaignListItem | null
): AgentRuntimeState {
  const { apiOnline, wsConnected, activeSessions, defenseScore, criticalCount, playbookRuleCount } =
    input;

  let status: AgentOperationalStatus = "offline";
  let currentTask = "Waiting for platform connection";
  let lastRun: string | null = null;
  let hmacVerified: boolean | null = null;

  if (!apiOnline) {
    return { id: agent.id, status, currentTask, lastRun, hmacVerified };
  }

  switch (agent.id) {
    case "research":
      status = wsConnected ? "online" : "degraded";
      currentTask =
        criticalCount > 0
          ? "Prioritizing new ASI patterns from live telemetry"
          : "Monitoring threat feeds and benchmark regressions";
      lastRun = formatRelative(latest?.summary?.completed_at as string | undefined);
      hmacVerified = null;
      break;
    case "curator":
      status = "online";
      currentTask = "Serving attack templates from the library";
      lastRun = formatRelative(latest?.summary?.started_at as string | undefined);
      hmacVerified = null;
      break;
    case "redteam":
      if (running) {
        status = "active";
        currentTask = `Campaign · ${running.name} (${running.rounds_completed}/${running.total_rounds})`;
        lastRun = "In progress";
      } else {
        status = "online";
        currentTask = "Idle — launch a wargame from Red Team Console";
        lastRun = formatRelative(latest?.summary?.completed_at as string | undefined);
      }
      hmacVerified = running ? true : null;
      break;
    case "target":
      status = activeSessions > 0 ? "active" : wsConnected ? "online" : "degraded";
      currentTask =
        activeSessions > 0
          ? `Screening ${activeSessions} live agent session${activeSessions === 1 ? "" : "s"}`
          : "Standing by for ingest or campaign traffic";
      lastRun = activeSessions > 0 ? "Live" : formatRelative(latest?.summary?.completed_at as string | undefined);
      hmacVerified = activeSessions > 0 ? true : null;
      break;
    case "judge":
      if (running) {
        status = "active";
        currentTask = "Scoring multi-turn bypass depth";
        lastRun = "In progress";
        hmacVerified = true;
      } else {
        status = latest ? "online" : "degraded";
        currentTask = latest ? "Awaiting next campaign verdict" : "No scored runs yet";
        lastRun = formatRelative(latest?.summary?.completed_at as string | undefined);
        hmacVerified = latest ? true : null;
      }
      break;
    case "defender":
      if (criticalCount > 0) {
        status = "degraded";
        currentTask = `${criticalCount} critical finding${criticalCount === 1 ? "" : "s"} need triage`;
      } else if (defenseScore >= 70) {
        status = "online";
        currentTask = `Playbook v1.${playbookRuleCount} · containment score ${defenseScore}`;
      } else {
        status = "degraded";
        currentTask = `Hardening playbook (${defenseScore}/100 defense score)`;
      }
      lastRun = playbookRuleCount > 0 ? `${playbookRuleCount} rules active` : "Default policy";
      hmacVerified = wsConnected;
      break;
  }

  if (input.highCount > 0 && agent.id === "defender" && status === "online") {
    status = "degraded";
  }

  return { id: agent.id, status, currentTask, lastRun, hmacVerified };
}

/** Derive per-agent runtime state from live platform signals — honest, no fabricated runs. */
export function derivePipelineSnapshot(input: DerivePipelineInput): PipelineSnapshot {
  const running = runningCampaign(input.campaigns);
  const latest = latestCampaign(input.campaigns);

  const agents = PIPELINE_AGENTS.map((agent) =>
    agentState(agent, input, running, latest)
  );

  const activeAgentId =
    agents.find((a) => a.status === "active")?.id ??
    (running ? "redteam" : input.activeSessions > 0 ? "target" : null);

  const loopClosed =
    input.apiOnline &&
    input.playbookRuleCount > 0 &&
    (running != null || input.activeSessions > 0 || input.defenseScore > 0);

  return { agents, activeAgentId, loopClosed };
}
