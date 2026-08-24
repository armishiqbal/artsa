"use client";

import { cn } from "@/lib/utils";
import {
  agentRoleClass,
  statusLabel,
  type AgentOperationalStatus,
  type PipelineAgentId,
} from "@/lib/agentRoles";
import { PIPELINE_AGENT_BY_ID } from "@/lib/agentRoles";
import type { AgentRuntimeState } from "@/lib/pipelineState";

interface AgentRoleBadgeProps {
  agentId: PipelineAgentId;
  showLabel?: boolean;
  className?: string;
}

/** Role accent dot + neutral label — color encodes agent, not severity. */
export function AgentRoleBadge({ agentId, showLabel = true, className }: AgentRoleBadgeProps) {
  const agent = PIPELINE_AGENT_BY_ID[agentId];
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        className={cn("h-2 w-2 shrink-0 rounded-full", agentRoleClass(agentId))}
        aria-hidden
      />
      {showLabel && (
        <span className="font-medium text-foreground">{agent.label}</span>
      )}
    </span>
  );
}

const STATUS_DOT: Record<AgentOperationalStatus, string> = {
  online: "bg-status-success",
  active: "bg-status-success animate-pulse",
  degraded: "bg-status-warning",
  offline: "bg-muted-foreground/40",
};

interface AgentStatusStripProps {
  agents: AgentRuntimeState[];
  selectedId?: PipelineAgentId | null;
  onSelect?: (id: PipelineAgentId) => void;
  compact?: boolean;
  className?: string;
}

/** Six-agent live status row — green / yellow / red at a glance. */
export function AgentStatusStrip({
  agents,
  selectedId,
  onSelect,
  compact = false,
  className,
}: AgentStatusStripProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6",
        className
      )}
      role="list"
      aria-label="Agent pipeline status"
    >
      {agents.map((agent) => {
        const def = PIPELINE_AGENT_BY_ID[agent.id];
        const selected = selectedId === agent.id;
        const interactive = Boolean(onSelect);

        const inner = (
          <>
            <div className="flex items-center justify-between gap-2">
              <AgentRoleBadge agentId={agent.id} />
              <span
                className={cn("h-2 w-2 shrink-0 rounded-full", STATUS_DOT[agent.status])}
                title={statusLabel(agent.status)}
                aria-label={statusLabel(agent.status)}
              />
            </div>
            {!compact && (
              <p className="mt-2 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                {agent.currentTask}
              </p>
            )}
            {!compact && agent.lastRun && (
              <p className="mt-1 font-mono text-[10px] text-muted-foreground/80">
                {agent.lastRun}
              </p>
            )}
          </>
        );

        const cardClass = cn(
          "agent-status-card rounded-xl border border-border bg-card/60 p-3 text-left transition-colors",
          selected && "border-foreground/25 bg-muted/30 ring-1 ring-inset ring-foreground/10",
          interactive && "cursor-pointer hover:border-foreground/20 hover:bg-muted/20",
          compact && "p-2.5"
        );

        if (interactive) {
          return (
            <button
              key={agent.id}
              type="button"
              role="listitem"
              className={cardClass}
              onClick={() => onSelect?.(agent.id)}
              aria-pressed={selected}
            >
              {inner}
            </button>
          );
        }

        return (
          <div key={agent.id} role="listitem" className={cardClass}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}
