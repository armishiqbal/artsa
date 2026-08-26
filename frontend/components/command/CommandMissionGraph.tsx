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

function nodeRadius(node: CommandGraphNode): number {
  const base =
    node.kind === "tool" ? 16 : node.kind === "session" ? 22 : node.kind === "control" ? 26 : 24;
  const bump = Math.min(10, Math.floor(Math.log2(Math.max(node.eventCount, 1)) * 3));
  return base + bump;
}

function curvedPath(a: CommandGraphNode, b: CommandGraphNode): string {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ox = (-dy / len) * 36;
  const oy = (dx / len) * 36;
  return `M ${a.x} ${a.y} Q ${mx + ox} ${my + oy} ${b.x} ${b.y}`;
}

function riskArcPath(r: number, score: number): string {
  const t = Math.max(0, Math.min(1, score / 100));
  const start = -Math.PI * 0.75;
  const end = start + t * Math.PI * 1.5;
  const x1 = Math.cos(start) * r;
  const y1 = Math.sin(start) * r;
  const x2 = Math.cos(end) * r;
  const y2 = Math.sin(end) * r;
  const large = t > 0.5 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

export function CommandMissionGraph({
  graph,
  selectedId,
  onSelect,
  className,
}: CommandMissionGraphProps) {
  const byId = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph.nodes]);
  const selected = selectedId ? byId.get(selectedId) ?? null : null;
  const W = COMMAND_GRAPH_VIEW.width;
  const H = COMMAND_GRAPH_VIEW.height;

  const neighborIds = useMemo(() => {
    if (!selected) return new Set<string>();
    const set = new Set<string>([selected.id]);
    for (const e of graph.edges) {
      if (e.source === selected.id) set.add(e.target);
      if (e.target === selected.id) set.add(e.source);
    }
    return set;
  }, [graph.edges, selected]);

  const severityBars = useMemo(() => {
    const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, SAFE: 0 };
    for (const n of graph.nodes) counts[n.severity] += 1;
    return counts;
  }, [graph.nodes]);

  const showLanes = graph.nodes.some((n) => n.kind === "tool") && graph.nodes.some((n) => n.kind === "agent");

  return (
    <div
      className={cn(
        "command-mission-graph relative h-full min-h-[520px] w-full overflow-hidden rounded-[8px] border border-[#313131] bg-[#0a0a0a]",
        className
      )}
    >
      {/* Atmosphere */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(#1e1e1e 1px, transparent 1px), linear-gradient(90deg, #1e1e1e 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          opacity: 0.35,
          maskImage: "radial-gradient(ellipse 80% 70% at 50% 45%, black, transparent)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 50% 40% at 50% 50%, hsl(221 100% 70% / 0.04), transparent 70%)",
        }}
        aria-hidden
      />

      {/* HUD top bar */}
      <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between gap-3 border-b border-[#313131]/80 bg-[#0a0a0a]/85 px-3 py-2 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-[0.08em] text-[#7c7c7c]">
          <span className="text-[#6798ff]">Containment map</span>
          <span className="text-[#454545]">|</span>
          <span>
            nodes <span className="text-white">{graph.nodes.length}</span>
          </span>
          <span>
            edges <span className="text-white">{graph.edges.length}</span>
          </span>
          <span>
            events <span className="text-white">{graph.totalEvents}</span>
          </span>
          <span>
            max risk{" "}
            <span
              className={cn(
                graph.maxRisk >= 80
                  ? "text-[hsl(var(--severity-critical))]"
                  : graph.maxRisk >= 50
                    ? "text-[hsl(var(--severity-high))]"
                    : "text-white"
              )}
            >
              {Math.round(graph.maxRisk)}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-1.5" aria-hidden>
          {(["CRITICAL", "HIGH", "MEDIUM", "SAFE"] as const).map((s) => (
            <div key={s} className="flex items-end gap-0.5" title={`${s}: ${severityBars[s]}`}>
              <div
                className="w-1.5 rounded-sm"
                style={{
                  height: Math.max(4, severityBars[s] * 6),
                  background:
                    s === "CRITICAL"
                      ? "hsl(var(--severity-critical))"
                      : s === "HIGH"
                        ? "hsl(var(--severity-high))"
                        : s === "MEDIUM"
                          ? "hsl(var(--severity-medium))"
                          : "#454545",
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Corner brackets — ops chrome */}
      <div className="pointer-events-none absolute left-2 top-10 z-20 h-3 w-3 border-l border-t border-[#454545]" aria-hidden />
      <div className="pointer-events-none absolute right-2 top-10 z-20 h-3 w-3 border-r border-t border-[#454545]" aria-hidden />
      <div className="pointer-events-none absolute bottom-10 left-2 z-20 h-3 w-3 border-b border-l border-[#454545]" aria-hidden />
      <div className="pointer-events-none absolute bottom-10 right-2 z-20 h-3 w-3 border-b border-r border-[#454545]" aria-hidden />
      <div className="pointer-events-none absolute left-3 top-11 z-20 font-mono text-[9px] text-[#454545]">
        AGENTS
      </div>
      {showLanes ? (
        <div className="pointer-events-none absolute right-3 top-11 z-20 font-mono text-[9px] text-[#454545]">
          TOOLS
        </div>
      ) : null}

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="relative z-10 h-full w-full pt-8"
        role="img"
        aria-label="Command Center containment map"
        onClick={() => onSelect(null)}
      >
        <defs>
          <marker
            id="cmd-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#454545" />
          </marker>
          <marker
            id="cmd-arrow-hot"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--severity-critical))" />
          </marker>
          <filter id="cmd-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Zone rings — threat geography */}
        <g opacity={0.2} fill="none" stroke="#313131" strokeWidth={1}>
          <ellipse cx={W / 2} cy={H / 2 + 10} rx={280} ry={180} />
          <ellipse cx={W / 2} cy={H / 2 + 10} rx={180} ry={110} strokeDasharray="4 6" />
          <ellipse cx={W / 2} cy={H / 2 + 10} rx={90} ry={55} stroke="#6798ff" strokeOpacity={0.4} />
        </g>

        {/* Swimlane guides */}
        {showLanes ? (
          <g opacity={0.15} stroke="#454545" strokeWidth={1} strokeDasharray="2 8">
            <line x1={W / 2} y1={70} x2={W / 2} y2={H - 40} />
          </g>
        ) : null}

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

      {graph.source === "idle" || graph.nodes.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center px-6 pt-8 pb-12">
          <div className="max-w-md text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#6798ff]">
              Live feed idle
            </p>
            <p className="mt-2 text-[15px] font-medium tracking-[-0.19px] text-white">
              Waiting for real topology or ingest
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-[#a7a7a7]">
              This map only renders live agents, sessions, and tools from the containment API — nothing synthetic.
            </p>
          </div>
        </div>
      ) : null}

      {/* Legend + posture */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 flex items-end justify-between gap-3 border-t border-[#313131]/80 bg-[#0a0a0a]/90 px-3 py-2">
        <div className="flex flex-wrap gap-3 font-mono text-[10px] uppercase tracking-[0.08em] text-[#7c7c7c]">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--severity-critical))]" />
            Breach
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--severity-high))]" />
            Quarantine
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#6798ff]" />
            Active call
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rotate-45 border border-[#a7a7a7]" />
            Tool
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full border border-[#a7a7a7]" />
            Agent
          </span>
        </div>
        <p className="font-mono text-[10px] text-[#454545]">
          {graph.source === "idle"
            ? "no live nodes"
            : graph.compromisedCount > 0
              ? `${graph.compromisedCount} elevated · investigate`
              : "posture quiet"}
        </p>
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
  const active = edge.status === "ACTIVE" || hot;
  const stroke = edgeStroke(edge.status);
  const d = curvedPath(source, target);
  const width = highlighted ? 2.75 : hot ? 2.25 : active ? 1.5 : 1;

  return (
    <g opacity={dimmed ? 0.12 : 1}>
      {/* Hit / glow underlay */}
      {hot ? (
        <path d={d} fill="none" stroke={stroke} strokeWidth={width + 4} opacity={0.15} />
      ) : null}
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={width}
        strokeDasharray={edge.status === "COMPROMISED" ? "7 4" : undefined}
        markerEnd={hot ? "url(#cmd-arrow-hot)" : "url(#cmd-arrow)"}
        opacity={highlighted ? 1 : 0.7}
      />
      {/* Traffic pulse on active / hot links */}
      {active && !dimmed ? (
        <circle r={hot ? 3.5 : 2.5} fill={stroke} opacity={0.9}>
          <animateMotion dur={hot ? "1.6s" : "2.8s"} repeatCount="indefinite" path={d} />
        </circle>
      ) : null}
      {highlighted || hot ? (
        <text
          x={(source.x + target.x) / 2}
          y={(source.y + target.y) / 2 - 12}
          fill="#a7a7a7"
          fontSize={9}
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
  const r = nodeRadius(node);
  const stroke = selected ? "#ffffff" : severityStroke(node.severity);
  const hot = node.severity === "CRITICAL" || node.severity === "HIGH";

  return (
    <g
      transform={`translate(${node.x}, ${node.y})`}
      opacity={dimmed ? 0.18 : 1}
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
        <circle r={r + 10} fill="none" stroke={stroke} strokeWidth={1} opacity={0.3} filter="url(#cmd-glow)">
          <animate
            attributeName="r"
            values={`${r + 7};${r + 14};${r + 7}`}
            dur="2.6s"
            repeatCount="indefinite"
          />
          <animate attributeName="opacity" values="0.35;0.1;0.35" dur="2.6s" repeatCount="indefinite" />
        </circle>
      ) : null}

      {/* Risk gauge track */}
      {node.riskScore > 0 ? (
        <g opacity={0.9}>
          <path
            d={riskArcPath(r + 5, 100)}
            fill="none"
            stroke="#313131"
            strokeWidth={2}
            strokeLinecap="round"
          />
          <path
            d={riskArcPath(r + 5, node.riskScore)}
            fill="none"
            stroke={stroke}
            strokeWidth={2.25}
            strokeLinecap="round"
          />
        </g>
      ) : null}

      {node.kind === "tool" ? (
        <rect
          x={-r}
          y={-r}
          width={r * 2}
          height={r * 2}
          rx={3}
          transform="rotate(45)"
          fill="#141414"
          stroke={stroke}
          strokeWidth={selected ? 2.5 : 1.5}
        />
      ) : node.kind === "control" ? (
        <rect
          x={-r}
          y={-r * 0.65}
          width={r * 2}
          height={r * 1.3}
          rx={5}
          fill="#141414"
          stroke={stroke}
          strokeWidth={selected ? 2.5 : 1.5}
        />
      ) : node.kind === "session" ? (
        <g>
          <circle r={r} fill="#141414" stroke={stroke} strokeWidth={selected ? 2.5 : 1.5} />
          <circle r={r - 5} fill="none" stroke="#313131" strokeWidth={1} />
        </g>
      ) : (
        <circle r={r} fill="#141414" stroke={stroke} strokeWidth={selected ? 2.5 : 1.5} />
      )}

      <text
        y={2}
        fill="#ffffff"
        fontSize={node.kind === "tool" ? 8 : 10}
        fontWeight={600}
        textAnchor="middle"
        className="pointer-events-none select-none"
        style={{ letterSpacing: "-0.02em" }}
      >
        {node.label.length > 12 ? `${node.label.slice(0, 10)}…` : node.label}
      </text>

      <text
        y={r + 14}
        fill="#7c7c7c"
        fontSize={8}
        textAnchor="middle"
        className="pointer-events-none font-mono uppercase"
      >
        {node.riskScore > 0
          ? `R${Math.round(node.riskScore)} · n${node.eventCount}`
          : node.kind}
      </text>
    </g>
  );
}
