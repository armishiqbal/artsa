"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Zap, Network } from "lucide-react";
import Link from "next/link";
import { fetchFromBackend } from "@/lib/api";
import { EMPTY_STATE_UI } from "@/lib/getStartedLabels";
import { DashboardCard } from "@/components/shared/DashboardCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import TopologyGraphView from "@/components/topology/TopologyGraphView";
import TopologyTableView from "@/components/topology/TopologyTableView";
import { computeNodePosition } from "@/components/topology/layout";
import type {
  TopologyApiEdge,
  TopologyApiNode,
  TopologyEdge,
  TopologyNode,
} from "@/components/topology/types";

export default function MultiAgentTopologyGraph() {
  const router = useRouter();
  const [selectedNode, setSelectedNode] = useState<TopologyNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<TopologyEdge | null>(null);
  const [nodes, setNodes] = useState<TopologyNode[]>([]);
  const [edges, setEdges] = useState<TopologyEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"graph" | "table">("graph");

  useEffect(() => {
    fetchFromBackend<{ nodes?: TopologyApiNode[]; edges?: TopologyApiEdge[] }>("/api/v1/topology", {
      silent: true,
    }).then((data) => {
      if (data?.nodes?.length) {
        const liveNodes: TopologyNode[] = data.nodes.map((n, i) => ({
          id: String(n.id),
          name: String(n.label),
          type: (n.type === "tool" ? "tool" : "agent") as TopologyNode["type"],
          trust: Number(n.risk_score) >= 70 ? "low" : Number(n.risk_score) >= 40 ? "medium" : "high",
          status: n.status === "BREACHED" ? "COMPROMISED" : "SAFE",
          ...computeNodePosition(i),
        }));
        const liveEdges: TopologyEdge[] = (data.edges || []).map((e, i) => ({
          id: `live-e${i}`,
          source: String(e.source),
          target: String(e.target),
          label: String(e.type ?? "call"),
          payload: String(e.type ?? "tool_call"),
          status: "SAFE" as const,
        }));
        setNodes(liveNodes);
        setEdges(liveEdges);
        setSelectedNode(liveNodes[0] ?? null);
        setSelectedEdge(liveEdges[0] ?? null);
      }
      setLoading(false);
    });
  }, []);

  const compromisedCount = nodes.filter((n) => n.status === "COMPROMISED").length;

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Skeleton className="h-[480px] lg:col-span-2 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <EmptyState
        icon={Network}
        title={EMPTY_STATE_UI.noTopologyTitle}
        description={EMPTY_STATE_UI.noTopologyDescription}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild size="sm">
              <Link href="/get-started">{EMPTY_STATE_UI.openSetup}</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/campaigns">{EMPTY_STATE_UI.runWargame}</Link>
            </Button>
          </div>
        }
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <DashboardCard
        className="lg:col-span-2"
        title="Contagion Graph"
        description="Agent-mediated lateral movement visualization"
        badge={
          <div className="flex gap-2">
            <Badge variant="success">Live</Badge>
            <Badge variant="critical">
              {compromisedCount}/{nodes.length} compromised
            </Badge>
          </div>
        }
        contentClassName="space-y-4"
      >
        <div className="flex gap-2">
          <Button
            variant={viewMode === "graph" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("graph")}
          >
            Graph
          </Button>
          <Button
            variant={viewMode === "table" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("table")}
          >
            Table
          </Button>
        </div>

        {viewMode === "graph" ? (
          <TopologyGraphView
            nodes={nodes}
            edges={edges}
            selectedNode={selectedNode}
            selectedEdge={selectedEdge}
            onSelectNode={setSelectedNode}
            onSelectEdge={setSelectedEdge}
          />
        ) : (
          <TopologyTableView nodes={nodes} onSelectNode={setSelectedNode} />
        )}
      </DashboardCard>

      <div className="space-y-4">
        {selectedNode && (
          <DashboardCard title="Node Inspector" badge={<Badge variant={selectedNode.status === "COMPROMISED" ? "critical" : "success"}>{selectedNode.status}</Badge>}>
            <p className="text-sm font-medium">{selectedNode.name}</p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {selectedNode.id} · {selectedNode.type} · trust {selectedNode.trust}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full font-mono text-xs"
              onClick={() => router.push(`/replay?session=${selectedNode.id}`)}
            >
              Open session replay
            </Button>
          </DashboardCard>
        )}
        {selectedEdge && (
          <DashboardCard title="Channel Payload" badge={<Zap className="h-4 w-4 text-severity-medium" aria-hidden />}>
            <p className="text-xs font-medium">{selectedEdge.label}</p>
            <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-border bg-muted/50 p-3 font-mono text-xs text-destructive">
              {selectedEdge.payload}
            </pre>
          </DashboardCard>
        )}
      </div>
    </div>
  );
}
