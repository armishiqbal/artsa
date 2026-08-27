"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { LayoutGrid, Network, Table2 } from "lucide-react";
import { CommandMissionGraph } from "@/components/command/CommandMissionGraph";
import { CommandGraphInspector } from "@/components/command/CommandGraphInspector";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useCommandGraph } from "@/lib/hooks/useCommandGraph";
import type { CommandGraphNode } from "@/lib/commandGraph";
import { cn } from "@/lib/utils";

interface CommandGraphPanelProps {
  events: Array<Record<string, unknown>>;
  apiOnline: boolean;
  className?: string;
}

export function CommandGraphPanel({
  events,
  apiOnline,
  className,
}: CommandGraphPanelProps) {
  const { graph, loading, hasLiveData } = useCommandGraph(events, apiOnline);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"graph" | "list">("graph");
  const autoSelectedRef = useRef(false);

  const selected = useMemo(
    () => graph.nodes.find((n) => n.id === selectedId) ?? null,
    [graph.nodes, selectedId]
  );

  // Focus the hottest live node once when traffic first appears.
  useEffect(() => {
    if (autoSelectedRef.current || !graph.nodes.length) return;
    const hot = [...graph.nodes].sort((a, b) => b.riskScore - a.riskScore)[0];
    if (hot && hot.riskScore >= 50) {
      setSelectedId(hot.id);
      autoSelectedRef.current = true;
    }
  }, [graph.nodes]);

  const sourceLabel =
    graph.source === "topology"
      ? "Live topology"
      : graph.source === "telemetry"
        ? "Live telemetry"
        : "Awaiting traffic";

  if (loading) {
    return (
      <div className={cn("grid gap-4 lg:grid-cols-[1fr_300px]", className)}>
        <Skeleton className="h-[560px] rounded-[8px]" />
        <Skeleton className="h-[560px] rounded-[8px]" />
      </div>
    );
  }

  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[15px] font-medium tracking-[-0.19px] text-foreground">
              Containment map
            </h2>
            <Badge variant="outline" className="font-mono text-[10px] uppercase">
              {sourceLabel}
            </Badge>
            {hasLiveData && graph.compromisedCount > 0 ? (
              <Badge variant="critical" className="font-mono text-[10px]">
                {graph.compromisedCount} elevated
              </Badge>
            ) : hasLiveData ? (
              <Badge variant="success" className="font-mono text-[10px]">
                Quiet
              </Badge>
            ) : null}
            {hasLiveData && graph.maxRisk > 0 ? (
              <Badge variant="outline" className="font-mono text-[10px]">
                max R{Math.round(graph.maxRisk)}
              </Badge>
            ) : null}
            {hasLiveData && graph.totalEvents > 0 ? (
              <Badge variant="outline" className="font-mono text-[10px]">
                {graph.totalEvents} evt
              </Badge>
            ) : null}
          </div>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {hasLiveData
              ? "Live session → agent → tool blast radius from topology + ingest"
              : "Waiting for live topology or ingest — no simulated nodes"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-[8px] border border-border bg-card p-0.5">
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                viewMode === "graph"
                  ? "bg-white text-[#0a0a0a]"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setViewMode("graph")}
              aria-pressed={viewMode === "graph"}
            >
              <Network className="h-3.5 w-3.5" aria-hidden />
              Graph
            </button>
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                viewMode === "list"
                  ? "bg-white text-[#0a0a0a]"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setViewMode("list")}
              aria-pressed={viewMode === "list"}
            >
              <Table2 className="h-3.5 w-3.5" aria-hidden />
              List
            </button>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/topology">
              <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
              Expand
            </Link>
          </Button>
        </div>
      </div>

      {viewMode === "graph" ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <CommandMissionGraph
            graph={graph}
            selectedId={selectedId}
            onSelect={(n) => setSelectedId(n?.id ?? null)}
            className="h-[560px]"
          />
          <CommandGraphInspector graph={graph} selected={selected} />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <CommandGraphList
            nodes={graph.nodes}
            selectedId={selectedId}
            onSelect={(n) => setSelectedId(n.id)}
            idle={graph.source === "idle"}
          />
          <CommandGraphInspector graph={graph} selected={selected} />
        </div>
      )}
    </section>
  );
}

function CommandGraphList({
  nodes,
  selectedId,
  onSelect,
  idle,
}: {
  nodes: CommandGraphNode[];
  selectedId: string | null;
  onSelect: (n: CommandGraphNode) => void;
  idle?: boolean;
}) {
  const sorted = useMemo(
    () => [...nodes].sort((a, b) => b.riskScore - a.riskScore),
    [nodes]
  );

  if (idle || sorted.length === 0) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-[8px] border border-[#313131] bg-[#0a0a0a] px-6 text-center">
        <p className="max-w-sm text-[13px] text-[#a7a7a7]">
          No live nodes yet. Ingest agent tool calls or open the sandbox to generate real traffic.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[8px] border border-[#313131] bg-[#0a0a0a]">
      <table className="w-full text-left text-[13px]">
        <thead className="border-b border-[#313131] bg-[#1e1e1e] font-mono text-[10px] uppercase tracking-[0.08em] text-[#7c7c7c]">
          <tr>
            <th className="px-3 py-2.5 font-medium">Node</th>
            <th className="px-3 py-2.5 font-medium">Kind</th>
            <th className="px-3 py-2.5 font-medium">Severity</th>
            <th className="px-3 py-2.5 font-medium text-right">Events</th>
            <th className="px-3 py-2.5 font-medium text-right">Risk</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((n) => (
            <tr
              key={n.id}
              className={cn(
                "cursor-pointer border-b border-[#313131]/80 transition-colors hover:bg-[#1e1e1e]",
                selectedId === n.id && "bg-[#1e1e1e]"
              )}
              onClick={() => onSelect(n)}
            >
              <td className="px-3 py-2.5 font-medium text-white">{n.label}</td>
              <td className="px-3 py-2.5 font-mono text-[11px] uppercase text-[#a7a7a7]">
                {n.kind}
              </td>
              <td className="px-3 py-2.5 font-mono text-[11px] uppercase text-[#a7a7a7]">
                {n.severity}
              </td>
              <td className="px-3 py-2.5 text-right font-mono text-[#a7a7a7]">{n.eventCount}</td>
              <td className="px-3 py-2.5 text-right font-mono text-white">
                {Math.round(n.riskScore)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
