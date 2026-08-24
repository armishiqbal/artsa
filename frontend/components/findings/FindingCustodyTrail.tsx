"use client";

import { CheckCircle2, Lock } from "lucide-react";
import { DashboardCard } from "@/components/shared/DashboardCard";
import { AgentRoleBadge } from "@/components/pipeline/AgentStatusStrip";
import type { PipelineAgentId } from "@/lib/agentRoles";

interface FindingCustodyTrailProps {
  chain: Array<{
    agent: string;
    label: string;
    action: string;
    hmac_verified: boolean | null;
  }>;
}

export function FindingCustodyTrail({ chain }: FindingCustodyTrailProps) {
  return (
    <DashboardCard title="Chain of custody" description="Research → Defender hop trail for this finding">
      <ol className="space-y-3">
        {chain.map((hop, idx) => {
          const agentId = hop.agent as PipelineAgentId;
          return (
            <li
              key={`${hop.agent}-${idx}`}
              className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/10 px-3 py-2"
            >
              <div className="min-w-0">
                <AgentRoleBadge agentId={agentId} />
                <p className="mt-1 text-xs text-muted-foreground">{hop.action}</p>
              </div>
              <div className="shrink-0 text-xs">
                {hop.hmac_verified === true ? (
                  <span className="inline-flex items-center gap-1 text-status-success">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                    Verified
                  </span>
                ) : hop.hmac_verified === false ? (
                  <span className="text-destructive">Mismatch</span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Lock className="h-3 w-3" aria-hidden />
                    N/A
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </DashboardCard>
  );
}
