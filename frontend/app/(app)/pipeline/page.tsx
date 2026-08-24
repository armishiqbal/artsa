"use client";

import { useState } from "react";
import Link from "next/link";
import { GitBranch, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageStack } from "@/components/shared/PageStack";
import { DashboardCard } from "@/components/shared/DashboardCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { LiveIndicator } from "@/components/shared/LiveIndicator";
import { AgentPipelineDAG } from "@/components/pipeline/AgentPipelineDAG";
import { AgentStatusStrip } from "@/components/pipeline/AgentStatusStrip";
import { AgentDetailPanel } from "@/components/pipeline/AgentDetailPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { usePipelineOverview } from "@/lib/hooks/usePipelineOverview";
import { useConnection } from "@/lib/context/ConnectionProvider";
import type { PipelineAgentId } from "@/lib/agentRoles";
import { PIPELINE_AGENT_BY_ID } from "@/lib/agentRoles";

export default function PipelinePage() {
  const { pipeline, loading, refreshPolicies } = usePipelineOverview();
  const { apiOnline, wsConnected } = useConnection();
  const [selectedId, setSelectedId] = useState<PipelineAgentId | null>("defender");

  const selectedAgent =
    pipeline.agents.find((a) => a.id === selectedId) ?? pipeline.agents[0] ?? null;

  return (
    <PageStack>
      <PageHeader
        title="Agent Pipeline"
        description="Closed-loop adversarial workflow — Research through Defender and back. Click a node for task detail and integrity signals."
        icon={<GitBranch className="h-5 w-5" />}
        badge={<LiveIndicator connected={apiOnline && wsConnected} className="meta-badge" />}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="interactive-pill gap-2"
              onClick={() => void refreshPolicies()}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
        <Button asChild size="sm" className="interactive-pill">
          <Link href="/campaigns">Open Red Team Console</Link>
        </Button>
          </div>
        }
      />

      {loading ? (
        <Skeleton className="h-24 w-full rounded-xl" />
      ) : (
        <AgentStatusStrip
          agents={pipeline.agents}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <DashboardCard
          title="Pipeline graph"
          description="Multi-turn attack paths collapse into this loop — expand detail in the side panel, not a crowded flat graph."
          badge={
            pipeline.loopClosed ? (
              <Badge variant="outline" className="meta-badge">
                Loop active
              </Badge>
            ) : (
              <Badge variant="outline" className="meta-badge">
                Awaiting traffic
              </Badge>
            )
          }
          className="lg:col-span-2"
          contentClassName="pt-2"
        >
          {loading ? (
            <Skeleton className="mx-auto h-[220px] w-full max-w-3xl rounded-xl" />
          ) : !apiOnline ? (
            <EmptyState
              icon={GitBranch}
              title="Pipeline offline"
              description="Connect the ARTSA API to visualize live agent handoffs and integrity status."
              action={
                <Button asChild size="sm" variant="outline">
                  <Link href="/get-started">Setup guide</Link>
                </Button>
              }
              className="py-16"
            />
          ) : (
            <AgentPipelineDAG
              snapshot={pipeline}
              selectedId={selectedId}
              onSelect={setSelectedId}
              animatePacket={wsConnected && Boolean(pipeline.activeAgentId)}
            />
          )}
          {!loading && apiOnline && (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              {pipeline.activeAgentId
                ? `Packet shows handoff near ${PIPELINE_AGENT_BY_ID[pipeline.activeAgentId].label}`
                : "Run a wargame or ingest telemetry to animate the loop"}
            </p>
          )}
        </DashboardCard>

        {loading ? (
          <Skeleton className="h-80 rounded-xl" />
        ) : (
          <AgentDetailPanel agent={selectedAgent} />
        )}
      </div>

      <div className="callout-bar flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>
          Promote validated findings into playbook rules to close the Research → Defender loop.
        </span>
        <Button asChild variant="outline" size="sm" className="interactive-pill">
          <Link href="/sandbox">Test in sandbox → Promote</Link>
        </Button>
      </div>
    </PageStack>
  );
}
