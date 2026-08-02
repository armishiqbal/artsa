"use client";

import type { TopologyEdge, TopologyNode } from "./types";

interface TopologyGraphViewProps {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  selectedNode: TopologyNode | null;
  selectedEdge: TopologyEdge | null;
  onSelectNode: (node: TopologyNode) => void;
  onSelectEdge: (edge: TopologyEdge) => void;
}

export default function TopologyGraphView({
  nodes,
  edges,
  selectedNode,
  selectedEdge,
  onSelectNode,
  onSelectEdge,
}: TopologyGraphViewProps) {
  return (
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
            <g key={e.id} onClick={() => onSelectEdge(e)} className="cursor-pointer">
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
              <text
                x={(sNode.x + tNode.x) / 2}
                y={(sNode.y + tNode.y) / 2 - 8}
                fill="hsl(var(--muted-foreground))"
                fontSize="10"
                textAnchor="middle"
              >
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
              onClick={() => onSelectNode(n)}
              role="button"
              tabIndex={0}
              aria-label={`${n.name} (${n.id}), status ${n.status}`}
              onKeyDown={(ev) => {
                if (ev.key === "Enter" || ev.key === " ") {
                  ev.preventDefault();
                  onSelectNode(n);
                }
              }}
              className="cursor-pointer"
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
  );
}
