"use client";

import { useState } from "react";
import {
  Search,
  Layers,
  Zap,
  Bot,
  Scale,
  Shield,
  Lock,
  ArrowRight,
  CheckCircle2,
  Wrench,
  KeyRound,
  FileText,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CREW_SIX_AGENTS,
  type CrewAgentSpec,
} from "@/lib/redTeamDemoData";
import type { LiveAgentName } from "@/lib/liveMonitorEvents";

const AGENT_ICONS: Record<LiveAgentName, typeof Search> = {
  research: Search,
  curator: Layers,
  red_team: Zap,
  target: Bot,
  judge: Scale,
  defender: Shield,
};

export function CrewAgentChainViz({
  agents = CREW_SIX_AGENTS,
  activeAgentId,
  onSelectAgent,
  className,
}: {
  agents?: CrewAgentSpec[];
  activeAgentId?: LiveAgentName | null;
  onSelectAgent?: (id: LiveAgentName) => void;
  className?: string;
}) {
  const [selectedId, setSelectedId] = useState<LiveAgentName>(
    activeAgentId || "research"
  );

  const currentId = activeAgentId || selectedId;
  const selectedAgent = agents.find((a) => a.id === currentId) ?? agents[0];

  const handleSelect = (id: LiveAgentName) => {
    setSelectedId(id);
    onSelectAgent?.(id);
  };

  return (
    <div
      className={cn(
        "rounded-2xl border border-neutral-800 bg-[#0e0e0e] p-5 sm:p-6 shadow-xl space-y-4 text-white",
        className
      )}
      aria-label="CrewAI Multi-Agent Execution Chain"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-3.5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-neutral-400" />
              Autonomous Multi-Agent Crew Pipeline (Six-Agent Chain)
            </h3>
            <span className="rounded-md bg-neutral-900 border border-neutral-700/80 px-2 py-0.5 font-mono text-[9.5px] font-bold text-neutral-300">
              ADR-008 Compliant
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-1 font-sans">
            Sequential task delegation with signed HMAC cryptographic custody handoffs across Research → Curator → Red Team → Target → Judge → Defender.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span className="inline-flex items-center gap-1.5 text-emerald-400 bg-emerald-950/40 px-2.5 py-1 rounded-md border border-emerald-800/60 shadow-2xs">
            <Lock className="h-3 w-3" />
            HMAC Chain Verified
          </span>
        </div>
      </div>

      {/* Six-Agent Chain Horizontal Node Flow */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        {agents.map((agent, index) => {
          const isSelected = agent.id === currentId;
          const Icon = AGENT_ICONS[agent.id] ?? Bot;

          return (
            <div key={agent.id} className="relative flex flex-col">
              <button
                type="button"
                onClick={() => handleSelect(agent.id)}
                aria-label={`Hop ${agent.order} ${agent.name}`}
                className={cn(
                  "w-full text-left rounded-xl p-3.5 border transition-all duration-150 flex flex-col justify-between h-full group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-400",
                  isSelected
                    ? "bg-[#181818] border-white shadow-md ring-1 ring-white/20"
                    : "bg-[#121212] border-neutral-800 hover:bg-[#161616] hover:border-neutral-700"
                )}
              >
                {/* Top Role Header */}
                <div className="flex items-center justify-between gap-1 mb-2.5">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border",
                        isSelected
                          ? "border-neutral-600 bg-white text-black font-bold"
                          : "border-neutral-800 bg-[#1e1e1e] text-neutral-300 group-hover:text-white"
                      )}
                    >
                      <Icon className="h-3 w-3" />
                    </span>
                    <span className="font-mono text-[10px] font-bold uppercase text-neutral-400">
                      Hop {agent.order}
                    </span>
                  </div>

                  <span
                    className={cn(
                      "font-mono text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border",
                      agent.status === "done"
                        ? "border-emerald-800/60 bg-emerald-950/40 text-emerald-400"
                        : agent.status === "running"
                        ? "border-neutral-700 bg-neutral-800 text-white animate-pulse"
                        : agent.status === "contained"
                        ? "border-rose-800/60 bg-rose-950/40 text-rose-400"
                        : "border-neutral-800 bg-neutral-900 text-neutral-400"
                    )}
                  >
                    {agent.status}
                  </span>
                </div>

                {/* Name & Role */}
                <div className="space-y-0.5 my-1">
                  <p className="font-mono text-xs font-bold text-white truncate group-hover:text-neutral-200">
                    {agent.name}
                  </p>
                  <p className="text-[10.5px] text-neutral-400 line-clamp-1 font-sans">
                    {agent.role}
                  </p>
                </div>

                {/* Bottom Tools Chip */}
                <div className="mt-3 pt-2.5 border-t border-neutral-800 flex items-center justify-between gap-1 font-mono text-[9.5px] text-neutral-400">
                  <span className="truncate flex items-center gap-1">
                    <Wrench className="h-2.5 w-2.5 text-neutral-400" />
                    {agent.tools.length} Tools
                  </span>
                  {agent.hmacVerified && (
                    <span className="text-emerald-400 flex items-center gap-0.5 font-bold">
                      <Lock className="h-2 w-2" />
                      HMAC
                    </span>
                  )}
                </div>
              </button>

              {/* Connecting arrow indicator for desktop */}
              {index < agents.length - 1 && (
                <div className="hidden lg:block absolute -right-2.5 top-1/2 -translate-y-1/2 z-10 pointer-events-none text-neutral-600">
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected Agent Inspector Card */}
      {selectedAgent && (
        <div className="rounded-xl border border-neutral-800 bg-[#121212] p-4.5 space-y-3.5 shadow-md mt-2">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800/80 pb-3">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900 text-white">
                {(() => {
                  const CurrentIcon = AGENT_ICONS[selectedAgent.id] ?? Bot;
                  return <CurrentIcon className="h-4 w-4" />;
                })()}
              </span>
              <div>
                <h4 className="font-mono text-xs font-bold text-white">
                  {selectedAgent.name} · {selectedAgent.role}
                </h4>
                <p className="text-xs text-neutral-400 mt-0.5 font-mono">
                  Agent ID: <span className="text-neutral-200">{selectedAgent.id}</span> · Order in Chain: {selectedAgent.order} of 6
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 px-2.5 py-0.5 rounded-md">
                <KeyRound className="h-3 w-3" />
                HMAC Signed Receiver
              </span>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
            {/* Operational Goal & Backstory */}
            <div className="rounded-lg border border-neutral-800 bg-[#161616] p-3.5 space-y-2">
              <span className="font-mono text-[10px] uppercase font-bold text-neutral-400 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                Operational Goal
              </span>
              <p className="text-neutral-200 text-xs leading-relaxed font-sans">
                {selectedAgent.goal}
              </p>
              <div className="pt-2 border-t border-neutral-800">
                <span className="font-mono text-[9.5px] uppercase font-semibold text-neutral-400">
                  Backstory:
                </span>
                <p className="text-neutral-300 text-[11px] leading-relaxed italic mt-0.5 font-sans">
                  &ldquo;{selectedAgent.backstory}&rdquo;
                </p>
              </div>
            </div>

            {/* Context Handoff */}
            <div className="rounded-lg border border-neutral-800 bg-[#161616] p-3.5 space-y-2">
              <span className="font-mono text-[10px] uppercase font-bold text-neutral-400 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-neutral-300" />
                CrewAI Task Context Passing
              </span>
              <div className="space-y-2 font-mono">
                <div>
                  <span className="text-[9.5px] text-neutral-400 uppercase">Input Context (Ingested):</span>
                  <p className="text-[11px] text-neutral-200 font-medium truncate bg-[#1e1e1e] p-2 rounded border border-neutral-800 mt-1">
                    {selectedAgent.contextInput}
                  </p>
                </div>
                <div>
                  <span className="text-[9.5px] text-neutral-400 uppercase">Output Context (Delegated):</span>
                  <p className="text-[11px] text-white font-medium truncate bg-[#1e1e1e] p-2 rounded border border-neutral-800 mt-1">
                    {selectedAgent.contextOutput}
                  </p>
                </div>
              </div>
            </div>

            {/* Tools & Cryptographic State */}
            <div className="rounded-lg border border-neutral-800 bg-[#161616] p-3.5 space-y-2">
              <span className="font-mono text-[10px] uppercase font-bold text-neutral-400 flex items-center gap-1.5">
                <Wrench className="h-3.5 w-3.5 text-neutral-300" />
                Equipped Agent Tools ({selectedAgent.tools.length})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {selectedAgent.tools.map((tool) => (
                  <span
                    key={tool}
                    className="rounded border border-neutral-750 bg-neutral-850 px-2.5 py-0.5 font-mono text-[10px] text-neutral-200"
                  >
                    {tool}
                  </span>
                ))}
              </div>
              <div className="pt-2 border-t border-neutral-800 flex items-center justify-between text-[10.5px] font-mono text-neutral-400">
                <span>Execution Mode:</span>
                <span className="font-bold text-white">Sequential &amp; HMAC-Gated</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
