"use client";

import { useMemo } from "react";
import {
  COMMAND_GRAPH_VIEW,
  edgeStroke,
  severityStroke,
  type CommandGraphEdge,
  type CommandGraphModel,
  type CommandGraphNode,
} from "@/lib/commandGraph";
import { cn } from "@/lib/utils";

interface CommandMissionGraphProps {
  graph: CommandGraphModel;
  selectedId: string | null;
  onSelect: (node: CommandGraphNode | null) => void;
  className?: string;
}

function nodeRadius(kind: CommandGraphNode["kind"]): number {
  if (kind === "tool") return 18;
  if (kind === "session") return 22;
  if (kind === "control") return 28;
  return 26;
}

function curvedPath(a: CommandGraphNode, b: CommandGraphNode): string {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ox = (-dy / len) * 28;
  const oy = (dx / len) * 28;
  return `M ${a.x} ${a.y} Q ${mx + ox} ${my + oy} ${b.x} ${b.y}`;
}

export function CommandMissionGraph({
  graph,
  selectedId,
  onSelect,
  className,
}: CommandMissionGraphProps) {
  const byId = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph.nodes]);
  const selected = selectedId ? byId.get(selectedId) ?? null : null;

  const neighborIds = useMemo(() => {
    if (!selected) return new Set<string>();
    const set = new Set<string>([selected.id]);
    for (const e of graph.edges) {
      if (e.source === selected.id) set.add(e.target);
      if (e.target === selected.id) set.add(e.source);
    }
    return set;
  }, [graph.edges, selected]);

  return (
    <div
      className={cn(
        "command-mission-graph relative h-full min-h-[420px] w-full overflow-hidden rounded-[8px] border border-[#313131] bg-[#0a0a0a]",
        className
      )}
    >
      {/* Grid atmosphere */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(#1e1e1e 1px, transparent 1px), linear-gradient(90deg, #1e1e1e 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          maskImage: "radial-gradient(ellipse 75% 70% at 50% 45%, black, transparent)",
        }}
        aria-hidden
      />

      <svg
        viewBox={`0 0 ${COMMAND_GRAPH_VIEW.width} ${COMMAND_GRAPH_VIEW.height}`}
        className="relative z-10 h-full w-full"
        role="img"
        aria-label="Command Center mission graph"
        onClick={() => onSelect(null)}
      >
        <defs>
          <marker
            id="cmd-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#454545" />
          </marker>
          <marker
            id="cmd-arrow-hot"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--severity-critical))" />
          </marker>
          <filter id="cmd-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Crosshair center */}
        <g opacity={0.25} stroke="#454545" strokeWidth={1}>
          <line
            x1={COMMAND_GRAPH_VIEW.width / 2 - 40}
            y1={COMMAND_GRAPH_VIEW.height / 2}
            x2={COMMAND_GRAPH_VIEW.width / 2 + 40}
            y2={COMMAND_GRAPH_VIEW.height / 2}
          />
          <line
            x1={COMMAND_GRAPH_VIEW.width / 2}
            y1={COMMAND_GRAPH_VIEW.height / 2 - 40}
            x2={COMMAND_GRAPH_VIEW.width / 2}
            y2={COMMAND_GRAPH_VIEW.height / 2 + 40}
          />
          <circle
            cx={COMMAND_GRAPH_VIEW.width / 2}
            cy={COMMAND_GRAPH_VIEW.height / 2}
            r={8}
            fill="none"
          />
        </g>

        {graph.edges.map((edge) => {
          const s = byId.get(edge.source);
          const t = byId.get(edge.target);
          if (!s || !t) return null;
          return (
            <EdgeLayer
              key={edge.id}
              edge={edge}
              source={s}
              target={t}
              dimmed={Boolean(selected && !neighborIds.has(s.id) && !neighborIds.has(t.id))}
              highlighted={Boolean(
                selected && (edge.source === selected.id || edge.target === selected.id)
              )}
            />
          );
        })}

        {graph.nodes.map((node) => (
          <NodeLayer
            key={node.id}
            node={node}
            selected={selectedId === node.id}
            dimmed={Boolean(selected && !neighborIds.has(node.id))}
            onSelect={onSelect}
          />
        ))}
      </svg>

      <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-3 font-mono text-[10px] uppercase tracking-[0.08em] text-[#7c7c7c]">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--severity-critical))]" />
          Critical
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--severity-high))]" />
          High
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--primary))]" />
          Active
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[#454545]" />
          Safe
        </span>
      </div>
    </div>
  );
}

function EdgeLayer({
  edge,
  source,
  target,
  dimmed,
  highlighted,
}: {
  edge: CommandGraphEdge;
  source: CommandGraphNode;
  target: CommandGraphNode;
  dimmed: boolean;
  highlighted: boolean;
}) {
  const hot = edge.status === "COMPROMISED" || edge.status === "QUARANTINED";
  const stroke = edgeStroke(edge.status);
  return (
    <g opacity={dimmed ? 0.18 : 1}>
      <path
        d={curvedPath(source, target)}
        fill="none"
        stroke={stroke}
        strokeWidth={highlighted ? 2.5 : hot ? 2 : 1.25}
        strokeDasharray={edge.status === "COMPROMISED" ? "7 4" : undefined}
        markerEnd={hot ? "url(#cmd-arrow-hot)" : "url(#cmd-arrow)"}
        opacity={highlighted ? 1 : 0.75}
      />
      {highlighted || hot ? (
        <text
          x={(source.x + target.x) / 2}
          y={(source.y + target.y) / 2 - 10}
          fill="#a7a7a7"
          fontSize={10}
          textAnchor="middle"
          className="font-mono"
        >
          {edge.label}
          {edge.count > 1 ? ` ×${edge.count}` : ""}
        </text>
      ) : null}
    </g>
  );
}

function NodeLayer({
  node,
  selected,
  dimmed,
  onSelect,
}: {
  node: CommandGraphNode;
  selected: boolean;
  dimmed: boolean;
  onSelect: (node: CommandGraphNode) => void;
}) {
  const r = nodeRadius(node.kind);
  const stroke = selected ? "#ffffff" : severityStroke(node.severity);
  const hot = node.severity === "CRITICAL" || node.severity === "HIGH";

  return (
    <g
      transform={`translate(${node.x}, ${node.y})`}
      opacity={dimmed ? 0.22 : 1}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(node);
      }}
      role="button"
      tabIndex={0}
      aria-label={`${node.label}, ${node.kind}, risk ${node.riskScore}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(node);
        }
      }}
      className="cursor-pointer outline-none"
    >
      {hot ? (
        <circle
          r={r + 8}
          fill="none"
          stroke={stroke}
          strokeWidth={1}
          opacity={0.35}
          filter="url(#cmd-glow)"
        >
          <animate attributeName="r" values={`${r + 6};${r + 12};${r + 6}`} dur="2.4s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.4;0.12;0.4" dur="2.4s" repeatCount="indefinite" />
        </circle>
      ) : null}

      {node.kind === "tool" ? (
        <rect
          x={-r}
          y={-r}
          width={r * 2}
          height={r * 2}
          rx={4}
          transform="rotate(45)"
          fill="#1e1e1e"
          stroke={stroke}
          strokeWidth={selected ? 2.5 : 1.5}
        />
      ) : node.kind === "control" ? (
        <rect
          x={-r}
          y={-r * 0.7}
          width={r * 2}
          height={r * 1.4}
          rx={6}
          fill="#1e1e1e"
          stroke={stroke}
          strokeWidth={selected ? 2.5 : 1.5}
        />
      ) : (
        <circle
          r={r}
          fill="#1e1e1e"
          stroke={stroke}
          strokeWidth={selected ? 2.5 : 1.5}
        />
      )}

      <text
        y={node.kind === "tool" ? 4 : 3}
        fill="#ffffff"
        fontSize={node.kind === "tool" ? 9 : 10}
        fontWeight={600}
        textAnchor="middle"
        className="pointer-events-none select-none"
        style={{ letterSpacing: "-0.02em" }}
      >
        {node.label.length > 14 ? `${node.label.slice(0, 12)}…` : node.label}
      </text>

      {node.riskScore > 0 ? (
        <text
          y={r + 16}
          fill="#7c7c7c"
          fontSize={9}
          textAnchor="middle"
          className="pointer-events-none font-mono"
        >
          risk {Math.round(node.riskScore)}
        </text>
      ) : (
        <text
          y={r + 16}
          fill="#7c7c7c"
          fontSize={9}
          textAnchor="middle"
          className="pointer-events-none font-mono uppercase"
        >
          {node.kind}
        </text>
      )}
    </g>
  );
}
