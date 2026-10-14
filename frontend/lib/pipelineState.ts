import type { CampaignListItem } from "@/lib/hooks/useCampaigns";
import type { AgentOperationalStatus, PipelineAgentId } from "@/lib/agentRoles";
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
  loopVerified: boolean;
}

interface DerivePipelineInput {
  apiOnline: boolean;
  activeSessions: number;
  campaigns: CampaignListItem[];
}

function runningCampaign(campaigns: CampaignListItem[]): CampaignListItem | null {
  return campaigns.find((campaign) => campaign.status === "running") ?? null;
}

function pendingCampaign(campaigns: CampaignListItem[]): CampaignListItem | null {
  return campaigns.find((campaign) => campaign.status === "pending") ?? null;
}

/** Only campaign/session records can establish activity; API and WS health do not establish agent health. */
export function derivePipelineSnapshot(input: DerivePipelineInput): PipelineSnapshot {
  const running = input.apiOnline ? runningCampaign(input.campaigns) : null;
  const pending = input.apiOnline ? pendingCampaign(input.campaigns) : null;
  const agents: AgentRuntimeState[] = PIPELINE_AGENTS.map((agent) => {
    if (!input.apiOnline) {
      return {
        id: agent.id,
        status: "unknown",
        currentTask: "API unavailable; role status cannot be verified.",
        lastRun: null,
        hmacVerified: null,
      };
    }

    if (agent.id === "redteam" && running) {
      return {
        id: agent.id,
        status: "active",
        currentTask: `Campaign · ${running.name} (${running.rounds_completed}/${running.total_rounds})`,
        lastRun: "Campaign running",
        hmacVerified: null,
      };
    }
    if (agent.id === "redteam" && pending) {
      return {
        id: agent.id,
        status: "unknown",
        currentTask: `Campaign queued · ${pending.name}; execution not reported`,
        lastRun: null,
        hmacVerified: null,
      };
    }
    if (agent.id === "target" && input.activeSessions > 0) {
      return {
        id: agent.id,
        status: "active",
        currentTask: `Screening ${input.activeSessions} active session${input.activeSessions === 1 ? "" : "s"}`,
        lastRun: "Active session reported",
        hmacVerified: null,
      };
    }

    const taskByAgent: Record<PipelineAgentId, string> = {
      research: "Research hop activity is not reported in this view.",
      curator: "Curator hop activity is not reported in this view.",
      redteam: "No running campaign is reported.",
      target: "No active session is reported.",
      judge: "Judge hop activity is not reported in this view.",
      defender: "No verified Defender handoff or patch result is reported.",
    };
    return {
      id: agent.id,
      status: "unknown",
      currentTask: taskByAgent[agent.id],
      lastRun: null,
      hmacVerified: null,
    };
  });

  const activeAgentId = running
    ? "redteam"
    : input.apiOnline && input.activeSessions > 0
      ? "target"
      : null;

  // This view has no complete, receiver-verified Defender → Research proof.
  // Keep loop status unverified until that source is connected.
  return { agents, activeAgentId, loopClosed: false, loopVerified: false };
}
