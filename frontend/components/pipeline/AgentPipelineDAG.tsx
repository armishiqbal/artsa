"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  PIPELINE_AGENTS,
  PIPELINE_AGENT_BY_ID,
  agentRoleClass,
  statusLabel,
  type AgentOperationalStatus,
  type PipelineAgentId,
} from "@/lib/agentRoles";
import type { PipelineSnapshot } from "@/lib/pipelineState";

/** Fixed layout positions (viewBox 0 0 720 280) */
const NODE_LAYOUT: Record<PipelineAgentId, { x: number; y: number }> = {
  research: { x: 40, y: 120 },
  curator: { x: 140, y: 60 },
  redteam: { x: 260, y: 120 },
  target: { x: 380, y: 60 },
  judge: { x: 500, y: 120 },
  defender: { x: 620, y: 60 },
};

const LOOP_BACK = "M 620 95 Q 360 220 40 105";

interface AgentPipelineDAGProps {
  snapshot: PipelineSnapshot;
  selectedId: PipelineAgentId | null;
  onSelect: (id: PipelineAgentId) => void;
  animatePacket?: boolean;
  className?: string;
}

export function AgentPipelineDAG({
  snapshot,
  selectedId,
  onSelect,
  animatePacket = true,
  className,
}: AgentPipelineDAGProps) {
  const [packetStep, setPacketStep] = useState(0);

  const edges = useMemo(() => {
    return PIPELINE_AGENTS.map((agent) => {
      const from = NODE_LAYOUT[agent.id];
      const to = NODE_LAYOUT[agent.next];
      return {
        id: `${agent.id}-${agent.next}`,
        from,
        to,
        fromId: agent.id,
      };
    });
  }, []);

  const activeEdgeIndex = useMemo(() => {
    if (!snapshot.activeAgentId) return 0;
    const idx = PIPELINE_AGENTS.findIndex((a) => a.id === snapshot.activeAgentId);
    return idx >= 0 ? idx : 0;
  }, [snapshot.activeAgentId]);

  useEffect(() => {
    if (!animatePacket || !snapshot.activeAgentId) return;
    setPacketStep(activeEdgeIndex);
    const id = window.setInterval(() => {
      setPacketStep((s) => (s + 1) % PIPELINE_AGENTS.length);
    }, 2800);
    return () => window.clearInterval(id);
  }, [animatePacket, snapshot.activeAgentId, activeEdgeIndex]);

  const edge = edges[packetStep];
  const packetX = edge ? edge.from.x + (edge.to.x - edge.from.x) * 0.55 : 0;
  const packetY = edge ? edge.from.y + (edge.to.y - edge.from.y) * 0.55 : 0;

  const agentStatusById = Object.fromEntries(
    snapshot.agents.map((a) => [a.id, a.status])
  ) as Record<PipelineAgentId, AgentOperationalStatus>;

  return (
    <div className={cn("pipeline-dag relative w-full overflow-x-auto", className)}>
      <svg
        viewBox="0 0 720 280"
        className="mx-auto h-auto min-h-[220px] w-full max-w-3xl"
        role="img"
        aria-label="Agent pipeline directed graph"
      >
        <defs>
          <marker
            id="pipeline-arrow"
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="4"
            orient="auto"
          >
            <path d="M0,0 L8,4 L0,8 Z" className="fill-muted-foreground/50" />
          </marker>
        </defs>

        {/* Closed loop return path */}
        <path
          d={LOOP_BACK}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth="1.5"
          strokeDasharray="6 4"
          markerEnd="url(#pipeline-arrow)"
          opacity={0.7}
        />

        {edges.map((e, i) => (
          <line
            key={e.id}
            x1={e.from.x + 36}
            y1={e.from.y + 18}
            x2={e.to.x + 4}
            y2={e.to.y + 18}
            stroke={
              i === packetStep && snapshot.activeAgentId
                ? "hsl(var(--foreground) / 0.35)"
                : "hsl(var(--border))"
            }
            strokeWidth={i === packetStep && snapshot.activeAgentId ? 2 : 1.5}
            markerEnd="url(#pipeline-arrow)"
          />
        ))}

        <AnimatePresence>
          {animatePacket && snapshot.activeAgentId && edge && (
            <motion.circle
              key={packetStep}
              r={5}
              className="fill-primary"
              initial={{ cx: edge.from.x + 36, cy: edge.from.y + 18, opacity: 0 }}
              animate={{
                cx: [edge.from.x + 36, packetX, edge.to.x + 4],
                cy: [edge.from.y + 18, packetY, edge.to.y + 18],
                opacity: [0, 1, 1, 0],
              }}
              transition={{ duration: 2.4, ease: "easeInOut" }}
            />
          )}
        </AnimatePresence>

        {PIPELINE_AGENTS.map((agent) => {
          const pos = NODE_LAYOUT[agent.id];
          const selected = selectedId === agent.id;
          const active = snapshot.activeAgentId === agent.id;
          const status = agentStatusById[agent.id];

          return (
            <g key={agent.id} transform={`translate(${pos.x}, ${pos.y})`}>
              <foreignObject width="88" height="72" x={0} y={0}>
                <button
                  type="button"
                  onClick={() => onSelect(agent.id)}
                  className={cn(
                    "pipeline-node flex h-[68px] w-[84px] flex-col items-center justify-center rounded-xl border border-border bg-card/90 px-1 py-2 text-center shadow-sm transition-colors",
                    selected && "border-foreground/30 bg-muted/40 ring-1 ring-inset ring-foreground/10",
                    active && "pipeline-node--active",
                    !selected && "hover:border-foreground/20 hover:bg-muted/25"
                  )}
                  aria-pressed={selected}
                  aria-label={`${agent.label}, ${statusLabel(status)}`}
                >
                  <span
                    className={cn("mb-1 h-2 w-2 rounded-full", agentRoleClass(agent.id))}
                    aria-hidden
                  />
                  <span className="text-[10px] font-semibold leading-tight text-foreground">
                    {agent.label}
                  </span>
                  <span className="mt-0.5 text-[9px] text-muted-foreground">
                    {PIPELINE_AGENT_BY_ID[agent.id].headline.split(" ")[0]}
                  </span>
                </button>
              </foreignObject>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
