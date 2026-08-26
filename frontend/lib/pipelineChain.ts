/**
 * Closed-loop agent chain — hop semantics for Research → … → Defender → Research.
 */

import {
  PIPELINE_AGENTS,
  PIPELINE_AGENT_BY_ID,
  type PipelineAgentId,
} from "@/lib/agentRoles";
import type { AgentRuntimeState, PipelineSnapshot } from "@/lib/pipelineState";

export interface ChainHop {
  index: number;
  from: PipelineAgentId;
  to: PipelineAgentId;
  label: string;
  /** Short ops label on the edge */
  edgeTag: string;
}

export const CHAIN_HOPS: ChainHop[] = [
  {
    index: 1,
    from: "research",
    to: "curator",
    label: "Threat intel → attack catalog",
    edgeTag: "catalog",
  },
  {
    index: 2,
    from: "curator",
    to: "redteam",
    label: "Templates → adversarial campaign",
    edgeTag: "arm",
  },
  {
    index: 3,
    from: "redteam",
    to: "target",
    label: "Multi-turn attack → agent under test",
    edgeTag: "attack",
  },
  {
    index: 4,
    from: "target",
    to: "judge",
    label: "Tool traces → verdict scoring",
    edgeTag: "trace",
  },
  {
    index: 5,
    from: "judge",
    to: "defender",
    label: "Verdict → containment / policy",
    edgeTag: "verdict",
  },
  {
    index: 6,
    from: "defender",
    to: "research",
    label: "Playbook feedback → research loop",
    edgeTag: "feedback",
  },
];

export function hopFromAgent(id: PipelineAgentId): ChainHop {
  return CHAIN_HOPS.find((h) => h.from === id) ?? CHAIN_HOPS[0]!;
}

export function previousAgent(id: PipelineAgentId): PipelineAgentId {
  const agent = PIPELINE_AGENTS.find((a) => a.next === id);
  return agent?.id ?? "defender";
}

export function nextAgent(id: PipelineAgentId): PipelineAgentId {
  return PIPELINE_AGENT_BY_ID[id].next;
}

export function chainPosition(id: PipelineAgentId): number {
  return PIPELINE_AGENTS.findIndex((a) => a.id === id) + 1;
}

export interface ChainIntegritySummary {
  onlineCount: number;
  activeCount: number;
  degradedCount: number;
  offlineCount: number;
  activeHop: ChainHop | null;
  loopHealthy: boolean;
}

export function summarizeChain(snapshot: PipelineSnapshot): ChainIntegritySummary {
  let onlineCount = 0;
  let activeCount = 0;
  let degradedCount = 0;
  let offlineCount = 0;
  for (const a of snapshot.agents) {
    if (a.status === "online") onlineCount += 1;
    else if (a.status === "active") activeCount += 1;
    else if (a.status === "degraded") degradedCount += 1;
    else offlineCount += 1;
  }
  const activeHop = snapshot.activeAgentId
    ? hopFromAgent(snapshot.activeAgentId)
    : null;
  return {
    onlineCount,
    activeCount,
    degradedCount,
    offlineCount,
    activeHop,
    loopHealthy: snapshot.loopClosed && offlineCount === 0 && degradedCount < 3,
  };
}

export function agentById(
  agents: AgentRuntimeState[],
  id: PipelineAgentId
): AgentRuntimeState | null {
  return agents.find((a) => a.id === id) ?? null;
}
