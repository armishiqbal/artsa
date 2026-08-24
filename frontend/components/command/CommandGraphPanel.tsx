"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LayoutGrid, Network, Table2 } from "lucide-react";
import { CommandMissionGraph } from "@/components/command/CommandMissionGraph";
import { CommandGraphInspector } from "@/components/command/CommandGraphInspector";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useCommandGraph } from "@/lib/hooks/useCommandGraph";
import type { PipelineSnapshot } from "@/lib/pipelineState";
import type { CommandGraphNode } from "@/lib/commandGraph";
import { cn } from "@/lib/utils";

interface CommandGraphPanelProps {
  events: Array<Record<string, unknown>>;
  pipeline: PipelineSnapshot | null;
  apiOnline: boolean;
  className?: string;
}

export function CommandGraphPanel({
  events,
  pipeline,
  apiOnline,
  className,
}: CommandGraphPanelProps) {
  const { graph, loading } = useCommandGraph(events, pipeline, apiOnline);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"graph" | "list">("graph");

  const selected = useMemo(
    () => graph.nodes.find((n) => n.id === selectedId) ?? null,
    [graph.nodes, selectedId]
  );

  const sourceLabel =
    graph.source === "topology"
      ? "Live topology"
      : graph.source === "telemetry"
        ? "Telemetry graph"
        : "Control plane";

  if (loading) {
    return (
      <div className={cn("grid gap-4 lg:grid-cols-[1fr_300px]", className)}>
        <Skeleton className="h-[480px] rounded-[8px]" />
        <Skeleton className="h-[480px] rounded-[8px]" />
      </div>
    );
  }

  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[15px] font-medium tracking-[-0.19px] text-foreground">
              Mission graph
            </h2>
            <Badge variant="outline" className="font-mono text-[10px] uppercase">
              {sourceLabel}
            </Badge>
            {graph.compromisedCount > 0 ? (
              <Badge variant="critical" className="font-mono text-[10px]">
                {graph.compromisedCount} elevated
              </Badge>
            ) : (
              <Badge variant="success" className="font-mono text-[10px]">
                Quiet
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Agent · session · tool blast radius — select a node to investigate
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
            className="h-[480px]"
          />
          <CommandGraphInspector graph={graph} selected={selected} />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <CommandGraphList
            nodes={graph.nodes}
            selectedId={selectedId}
            onSelect={(n) => setSelectedId(n.id)}
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
}: {
  nodes: CommandGraphNode[];
  selectedId: string | null;
  onSelect: (n: CommandGraphNode) => void;
}) {
  const sorted = useMemo(
    () => [...nodes].sort((a, b) => b.riskScore - a.riskScore),
    [nodes]
  );

  return (
    <div className="overflow-hidden rounded-[8px] border border-[#313131] bg-[#0a0a0a]">
      <table className="w-full text-left text-[13px]">
        <thead className="border-b border-[#313131] bg-[#1e1e1e] font-mono text-[10px] uppercase tracking-[0.08em] text-[#7c7c7c]">
          <tr>
            <th className="px-3 py-2.5 font-medium">Node</th>
            <th className="px-3 py-2.5 font-medium">Kind</th>
            <th className="px-3 py-2.5 font-medium">Severity</th>
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
