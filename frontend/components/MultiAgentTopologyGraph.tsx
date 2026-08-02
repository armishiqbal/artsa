"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Zap, Network } from "lucide-react";
import Link from "next/link";
import { fetchFromBackend } from "@/lib/api";
import { DashboardCard } from "@/components/shared/DashboardCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface TopologyNode {
  id: string;
  name: string;
  type: "agent" | "tool" | "datastore" | "mcp_bridge";
  trust: "low" | "medium" | "high";
  status: "SAFE" | "COMPROMISED" | "EVALUATING";
  x: number;
  y: number;
}

interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  payload: string;
  status: "COMPROMISED" | "SAFE";
}

interface TopologyApiNode {
  id: string;
  label: string;
  type?: string;
  risk_score?: number;
  status?: string;
}

interface TopologyApiEdge {
  source: string;
  target: string;
  type?: string;
}

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
          x: 120 + (i % 4) * 160,
          y: 150 + Math.floor(i / 4) * 120,
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
      } else {
        setNodes([]);
        setEdges([]);
        setSelectedNode(null);
        setSelectedEdge(null);
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
        title="No topology data"
        description="Agent nodes appear when sessions are ingested via POST /api/v1/ingest or wargame campaigns."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild size="sm">
              <Link href="/wargame">Launch wargame</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/">Command Center</Link>
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
          <div className="relative h-[420px] overflow-hidden rounded-xl border border-border bg-zinc-950 p-4">
            <svg className="h-full w-full" role="img" aria-label="Multi-agent topology graph">
              <defs>
                <marker id="arrow-red" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--severity-critical))" />
                </marker>
                <marker id="arrow-green" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--severity-low))" />
                </marker>
              </defs>
              {edges.map((e) => {
                const sNode = nodes.find((n) => n.id === e.source);
                const tNode = nodes.find((n) => n.id === e.target);
                if (!sNode || !tNode) return null;
                const isComp = e.status === "COMPROMISED";
                const isSel = selectedEdge?.id === e.id;
                return (
                  <g key={e.id} onClick={() => setSelectedEdge(e)} className="cursor-pointer">
                    <line
                      x1={sNode.x}
                      y1={sNode.y}
                      x2={tNode.x}
                      y2={tNode.y}
                      stroke={isComp ? "hsl(var(--severity-critical))" : "hsl(var(--severity-low))"}
                      strokeWidth={isSel ? 3 : 2}
                      strokeDasharray={isComp ? "6,3" : "none"}
                      markerEnd={isComp ? "url(#arrow-red)" : "url(#arrow-green)"}
                    />
                    <text x={(sNode.x + tNode.x) / 2} y={(sNode.y + tNode.y) / 2 - 8} fill="hsl(var(--muted-foreground))" fontSize="10" textAnchor="middle">
                      {e.label}
                    </text>
                  </g>
                );
              })}
              {nodes.map((n) => {
                const isComp = n.status === "COMPROMISED";
                const isSel = selectedNode?.id === n.id;
                return (
                  <g
                    key={n.id}
                    transform={`translate(${n.x}, ${n.y})`}
                    onClick={() => setSelectedNode(n)}
                    className="cursor-pointer"
                    role="button"
                    tabIndex={0}
                    aria-label={`${n.name}, status ${n.status}`}
                    onKeyDown={(ev) => ev.key === "Enter" && setSelectedNode(n)}
                  >
                    <circle
                      r={24}
                      fill="hsl(var(--card))"
                      stroke={isSel ? "hsl(var(--primary))" : isComp ? "hsl(var(--severity-critical))" : "hsl(var(--severity-low))"}
                      strokeWidth={isSel ? 3 : 2}
                    />
                    <text y={4} fill="hsl(var(--foreground))" fontSize="11" textAnchor="middle">
                      {n.type === "agent" ? "🤖" : n.type === "mcp_bridge" ? "🔌" : n.type === "tool" ? "⚡" : "🗄️"}
                    </text>
                    <text y={40} fill="hsl(var(--foreground))" fontSize="10" fontWeight="bold" textAnchor="middle">
                      {n.name.length > 18 ? `${n.name.slice(0, 16)}…` : n.name}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  <th className="px-3 py-2 font-medium">Node</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Trust</th>
                </tr>
              </thead>
              <tbody>
                {nodes.map((n) => (
                  <tr
                    key={n.id}
                    className="cursor-pointer border-b border-border/50 hover:bg-muted/20"
                    onClick={() => setSelectedNode(n)}
                  >
                    <td className="px-3 py-2 font-mono">{n.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{n.type}</td>
                    <td className="px-3 py-2">
                      <Badge variant={n.status === "COMPROMISED" ? "critical" : "success"} className="text-[10px]">
                        {n.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{n.trust}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
            <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-border bg-zinc-950 p-3 font-mono text-xs text-destructive">
              {selectedEdge.payload}
            </pre>
          </DashboardCard>
        )}
      </div>
    </div>
  );
}
