"use client";

import Link from "next/link";
import { CheckCircle2, Lock, ShieldAlert } from "lucide-react";
import { DashboardCard } from "@/components/shared/DashboardCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AgentRoleBadge,
} from "@/components/pipeline/AgentStatusStrip";
import {
  PIPELINE_AGENT_BY_ID,
  statusLabel,
  type PipelineAgentId,
} from "@/lib/agentRoles";
import type { AgentRuntimeState } from "@/lib/pipelineState";

interface AgentDetailPanelProps {
  agent: AgentRuntimeState | null;
  className?: string;
}

export function AgentDetailPanel({ agent, className }: AgentDetailPanelProps) {
  if (!agent) {
    return (
      <DashboardCard
        title="Agent detail"
        description="Select a node in the pipeline to inspect its current task and trust signals."
        className={className}
      >
        <p className="text-sm text-muted-foreground">
          The closed loop runs Research → Curator → Red Team → Target → Judge → Defender → Research.
        </p>
      </DashboardCard>
    );
  }

  const def = PIPELINE_AGENT_BY_ID[agent.id];

  return (
    <DashboardCard
      title={def.label}
      description={def.headline}
      badge={
        <Badge variant="outline" className="meta-badge font-mono text-[10px] uppercase">
          {statusLabel(agent.status)}
        </Badge>
      }
      className={className}
    >
      <div className="space-y-4">
        <div>
          <p className="section-label mb-1.5">Current task</p>
          <p className="text-sm text-foreground">{agent.currentTask}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Last run
            </p>
            <p className="mt-1 font-mono text-xs text-foreground">
              {agent.lastRun ?? "—"}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Integrity
            </p>
            <div className="mt-1 flex items-center gap-1.5 text-xs">
              {agent.hmacVerified === true ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-status-success" aria-hidden />
                  <span>HMAC verified</span>
                </>
              ) : agent.hmacVerified === false ? (
                <>
                  <ShieldAlert className="h-3.5 w-3.5 text-status-warning" aria-hidden />
                  <span>Signature mismatch</span>
                </>
              ) : (
                <>
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                  <span>Not applicable</span>
                </>
              )}
            </div>
          </div>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">{def.description}</p>

        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          {agent.id === "redteam" && (
            <Button asChild size="sm" className="interactive-pill">
              <Link href="/campaigns">Open Red Team Console</Link>
            </Button>
          )}
          {agent.id === "defender" && (
            <Button asChild size="sm" variant="outline" className="interactive-pill">
              <Link href="/admin/policies">View playbook</Link>
            </Button>
          )}
          {agent.id === "curator" && (
            <Button asChild size="sm" variant="outline" className="interactive-pill">
              <Link href="/library">Attack library</Link>
            </Button>
          )}
          {agent.id === "target" && (
            <Button asChild size="sm" variant="outline" className="interactive-pill">
              <Link href="/sandbox">Scan payload</Link>
            </Button>
          )}
        </div>
      </div>
    </DashboardCard>
  );
}

export function AgentDetailPanelHeader({ agentId }: { agentId: PipelineAgentId }) {
  return <AgentRoleBadge agentId={agentId} />;
}
