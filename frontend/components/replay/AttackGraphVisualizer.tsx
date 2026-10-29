"use client";

import { useState, useMemo, type ComponentType } from "react";
import {
  Lock,
  Terminal,
  Database,
  Search,
  Server,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AttackHop } from "@/components/replay/AttackPathTimeline";
import type { Session } from "@/lib/types";

interface GraphNode {
  id: string;
  type: "agent" | "hop";
  label: string;
  sublabel: string;
  status: "BREACHED" | "SUSPICIOUS" | "SAFE" | "CONTAINED" | "NEUTRAL";
  risk: number | null;
  hopIndex?: number;
  x: number;
  y: number;
  icon: ComponentType<{ className?: string }>;
  mitre?: string;
  details?: string;
}

interface GraphEdge {
  from: string;
  to: string;
  label?: string;
  status: "breached" | "suspicious" | "safe" | "contained" | "neutral";
  animated?: boolean;
}

export function AttackGraphVisualizer({
  hops,
  selectedIndex,
  onSelectHop,
  session,
}: {
  hops: AttackHop[];
  selectedIndex: number;
  onSelectHop: (index: number) => void;
  session?: Session;
}) {
  const [filterMode, setFilterMode] = useState<"all" | "critical" | "blast">("all");
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);

  // Build this view from the selected session and its stored events only.
  const { nodes, edges } = useMemo(() => {
    const calculatedNodes: GraphNode[] = [];
    const calculatedEdges: GraphEdge[] = [];

    const nodeStatus = (verdict: string, risk: number | null): GraphNode["status"] => {
      const normalized = verdict.toUpperCase();
      if (normalized === "BREACHED" || (risk != null && risk >= 75)) return "BREACHED";
      if (normalized === "SUSPICIOUS" || (risk != null && risk >= 40)) return "SUSPICIOUS";
      if (normalized === "CONTAINED" || normalized === "QUARANTINED") return "CONTAINED";
      if (normalized === "SAFE" || normalized === "ALLOW") return "SAFE";
      return "NEUTRAL";
    };
    const edgeStatus = (status: GraphNode["status"]): GraphEdge["status"] => {
      if (status === "BREACHED") return "breached";
      if (status === "SUSPICIOUS") return "suspicious";
      if (status === "CONTAINED") return "contained";
      if (status === "SAFE") return "safe";
      return "neutral";
    };

    if (session) {
      calculatedNodes.push({
        id: "recorded-session",
        type: "agent",
        label: session.agent_id || "Agent not recorded",
        sublabel: "Session " + session.id,
        status: nodeStatus(session.status, session.max_risk_score ?? null),
        risk: session.max_risk_score ?? null,
        x: 40,
        y: 185,
        icon: Server,
        details: "Status and risk are from the stored session record.",
      });
    }

    const shownHops = hops.slice(0, 5);
    shownHops.forEach((hop, index) => {
      const status = nodeStatus(hop.verdict, hop.risk);
      let icon = Search;
      if (hop.toolName.toLowerCase().includes("sql") || hop.toolName.toLowerCase().includes("db")) icon = Database;
      if (hop.toolName.toLowerCase().includes("shell") || hop.toolName.toLowerCase().includes("exec")) icon = Terminal;
      if (hop.toolName.toLowerCase().includes("circuit") || hop.toolName.toLowerCase().includes("kill")) icon = Lock;

      const nodeId = `recorded-hop-${hop.index}`;
      const latency = hop.latency_ms == null ? null : hop.latency_ms;
      const recordedFields = [
        hop.verdict,
        hop.risk == null ? null : `${hop.risk.toFixed(0)} risk`,
        latency == null ? null : `${latency}ms`,
      ].filter(Boolean);
      calculatedNodes.push({
        id: nodeId,
        type: "hop",
        label: `Hop ${hop.index + 1}: ${hop.toolName}`,
        sublabel: recordedFields.length ? recordedFields.join(" · ") : "No evaluation metadata recorded",
        status,
        risk: hop.risk,
        hopIndex: hop.index,
        x: 300,
        y: 35 + index * 76,
        icon,
        details: `Recorded event verdict: ${hop.verdict}. Risk: ${hop.risk == null ? "not recorded" : hop.risk}. Latency: ${latency == null ? "not recorded" : `${latency}ms`}.`,
      });

      const previousId = index === 0 && session
        ? "recorded-session"
        : index > 0
          ? `recorded-hop-${shownHops[index - 1]!.index}`
          : null;
      if (previousId) {
        calculatedEdges.push({
          from: previousId,
          to: nodeId,
          label: latency == null ? undefined : `${latency}ms`,
          status: edgeStatus(status),
          animated: status === "BREACHED",
        });
      }
    });

    return { nodes: calculatedNodes, edges: calculatedEdges };
  }, [hops, session]);

  // Filter nodes according to active filter mode
  const displayedNodes = useMemo(() => {
    if (filterMode === "critical") {
      return nodes.filter(
        (n) => n.status === "BREACHED" || n.status === "SUSPICIOUS"
      );
    }
    if (filterMode === "blast") {
      return nodes.filter(
        (n) => n.type === "agent" || n.status === "BREACHED"
      );
    }
    return nodes;
  }, [nodes, filterMode]);

  const displayedNodeIds = useMemo(() => new Set(displayedNodes.map((n) => n.id)), [displayedNodes]);

  const displayedEdges = useMemo(() => {
    return edges.filter((e) => displayedNodeIds.has(e.from) && displayedNodeIds.has(e.to));
  }, [edges, displayedNodeIds]);

  const selectedNode = nodes.find((n) => n.hopIndex === selectedIndex);

  return (
    <div className="flex flex-col rounded-xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
      {/* Visualizer Control Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            <Radio className="h-3.5 w-3.5 text-blue-600 animate-pulse" />
            Recorded Session Event Path
          </span>
          <span className="rounded-full bg-blue-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-blue-700">
            Interactive
          </span>
        </div>

        {/* View & Filter Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs shadow-2xs">
            <button
              type="button"
              onClick={() => setFilterMode("all")}
              className={cn(
                "rounded px-2.5 py-1 font-mono text-[11px] font-medium transition-colors",
                filterMode === "all"
                  ? "bg-black text-white font-semibold shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              Full Graph
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("critical")}
              className={cn(
                "rounded px-2.5 py-1 font-mono text-[11px] font-medium transition-colors",
                filterMode === "critical"
                  ? "bg-rose-600 text-white font-semibold shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              Breached and Suspicious
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("blast")}
              className={cn(
                "rounded px-2.5 py-1 font-mono text-[11px] font-medium transition-colors",
                filterMode === "blast"
                  ? "bg-amber-600 text-white font-semibold shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              Session and Breaches
            </button>
          </div>

          <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0 border-slate-200 text-slate-700 hover:bg-slate-100"
              onClick={() => setZoomLevel((z) => Math.min(z + 0.15, 1.45))}
              title="Zoom In"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0 border-slate-200 text-slate-700 hover:bg-slate-100"
              onClick={() => setZoomLevel((z) => Math.max(z - 0.15, 0.7))}
              title="Zoom Out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 font-mono text-[10.5px] border-slate-200 text-slate-700 hover:bg-slate-100"
              onClick={() => setZoomLevel(1)}
              title="Reset View"
            >
              <Maximize2 className="mr-1 h-3 w-3" />
              Reset
            </Button>
          </div>
        </div>
      </div>

      {/* Interactive SVG Canvas */}
      <div className="relative overflow-x-auto bg-[#fafbfe] p-4 select-none min-h-[380px]">
        {displayedNodes.length === 0 && (
          <div className="absolute inset-0 z-10 flex items-center justify-center p-8 text-center text-sm text-slate-500">
            No session or event records are available for this graph view.
          </div>
        )}
        {/* Subtle cyber grid backdrop */}
        <div
          className="absolute inset-0 opacity-[0.4] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle, #cbd5e1 1px, transparent 1px)`,
            backgroundSize: "20px 20px",
          }}
        />

        <div
          className="relative mx-auto transition-transform duration-200 ease-out origin-top-left"
          style={{
            width: "920px",
            height: "440px",
            transform: `scale(${zoomLevel})`,
          }}
        >
          {/* SVG Connector Lines */}
          <svg className="absolute inset-0 h-full w-full pointer-events-none" style={{ zIndex: 1 }}>
            <defs>
              <linearGradient id="grad-breach" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f43f5e" />
                <stop offset="100%" stopColor="#e11d48" />
              </linearGradient>
              <linearGradient id="grad-safe" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
            </defs>

            {displayedEdges.map((edge, idx) => {
              const source = nodes.find((n) => n.id === edge.from);
              const target = nodes.find((n) => n.id === edge.to);
              if (!source || !target) return null;

              const isBreach = edge.status === "breached";
              const isSuspicious = edge.status === "suspicious";

              const strokeColor = isBreach ? "#e11d48" : isSuspicious ? "#f59e0b" : "#94a3b8";
              const strokeWidth = isBreach ? 2.5 : 1.75;

              // Cubic bezier curved path
              const dx = target.x - source.x;
              const pathD = `M ${source.x + 90} ${source.y + 25} C ${source.x + 90 + dx * 0.5} ${source.y + 25}, ${target.x - dx * 0.5} ${target.y + 25}, ${target.x} ${target.y + 25}`;

              return (
                <g key={`edge-${idx}`}>
                  <path
                    d={pathD}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={edge.animated ? "6,4" : undefined}
                    className={edge.animated ? "animate-pulse" : undefined}
                    opacity={isBreach ? 0.95 : 0.65}
                  />
                  {edge.label && (
                    <text
                      x={(source.x + 90 + target.x) / 2}
                      y={(source.y + 25 + target.y + 25) / 2 - 6}
                      fill={isBreach ? "#be123c" : "#64748b"}
                      fontSize="9.5"
                      fontFamily="monospace"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {edge.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Interactive Graph Nodes */}
          {displayedNodes.map((node) => {
            const isSelected = node.hopIndex !== undefined && node.hopIndex === selectedIndex;
            const isBreach = node.status === "BREACHED";
            const isSuspicious = node.status === "SUSPICIOUS";
            const isContained = node.status === "CONTAINED";
            const Icon = node.icon;

            return (
              <div
                key={node.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (node.hopIndex !== undefined) {
                    onSelectHop(node.hopIndex);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    if (node.hopIndex !== undefined) onSelectHop(node.hopIndex);
                  }
                }}
                onMouseEnter={() => setHoveredNode(node)}
                onMouseLeave={() => setHoveredNode(null)}
                style={{
                  left: `${node.x}px`,
                  top: `${node.y}px`,
                  zIndex: isSelected ? 30 : 10,
                }}
                className={cn(
                  "absolute w-[180px] cursor-pointer rounded-xl border p-2.5 transition-all duration-150 select-none",
                  isSelected
                    ? "ring-2 ring-blue-500 ring-offset-2 shadow-md bg-white border-blue-500 scale-105"
                    : isBreach
                    ? "border-rose-300 bg-rose-50/90 hover:bg-rose-100/90 shadow-2xs hover:scale-102"
                    : isSuspicious
                    ? "border-amber-300 bg-amber-50/90 hover:bg-amber-100/90 shadow-2xs hover:scale-102"
                    : isContained
                    ? "border-blue-300 bg-blue-50/90 hover:bg-blue-100/90 shadow-2xs hover:scale-102"
                    : "border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50 shadow-2xs hover:scale-102"
                )}
              >
                <div className="flex items-start justify-between gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-lg border",
                        isBreach
                          ? "border-rose-300 bg-rose-100 text-rose-700"
                          : isSuspicious
                          ? "border-amber-300 bg-amber-100 text-amber-700"
                          : isContained
                          ? "border-blue-300 bg-blue-100 text-blue-700"
                          : "border-slate-200 bg-slate-100 text-slate-700"
                      )}
                    >
                      <Icon className="h-3 w-3" />
                    </span>
                    <span className="font-mono text-[9.5px] font-bold uppercase tracking-wider text-slate-500">
                      {node.type}
                    </span>
                  </div>

                  <span
                    className={cn(
                      "font-mono text-[10px] font-bold tabular-nums px-1.5 py-0.2 rounded border",
                      isBreach
                        ? "border-rose-300 bg-rose-200/60 text-rose-800"
                        : isSuspicious
                        ? "border-amber-300 bg-amber-200/60 text-amber-800"
                        : "border-slate-200 bg-slate-100 text-slate-700"
                    )}
                  >
                    {node.risk == null ? "Risk —" : node.risk.toFixed(0)}
                  </span>
                </div>

                <div className="mt-2 min-w-0">
                  <p className="font-mono text-xs font-bold text-slate-900 truncate" title={node.label}>
                    {node.label}
                  </p>
                  <p className="font-mono text-[10.5px] text-slate-500 truncate" title={node.sublabel}>
                    {node.sublabel}
                  </p>
                </div>

                {node.hopIndex !== undefined && (
                  <div className="mt-2 border-t border-slate-200/60 pt-1.5 font-mono text-[9px] text-slate-500">
                    Stored event #{node.hopIndex + 1}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Node Inspector Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/80 px-4 py-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] font-semibold text-slate-600">Active Node:</span>
          {hoveredNode || selectedNode ? (
            <span className="font-mono text-[11px] font-bold text-slate-900">
              {(hoveredNode ?? selectedNode)?.label} — {(hoveredNode ?? selectedNode)?.details}
            </span>
          ) : (
            <span className="font-mono text-[11px] text-slate-500">
              Hover or click any node to focus forensic evidence in the workbench below.
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 font-mono text-[10px] text-slate-500">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-rose-500" /> Critical Breach
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-500" /> Suspicious Shift
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-blue-500" /> Contained / Guard
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Safe Path
          </span>
        </div>
      </div>
    </div>
  );
}
