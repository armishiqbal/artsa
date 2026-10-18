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
        "rounded-xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-2xs space-y-4",
        className
      )}
      aria-label="CrewAI Multi-Agent Execution Chain"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-blue-600" />
              Autonomous Multi-Agent Crew Pipeline (Six-Agent Chain)
            </h3>
            <span className="rounded bg-blue-50 border border-blue-200/80 px-1.5 py-0.2 font-mono text-[9.5px] font-bold text-blue-700">
              ADR-008 Compliant
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 font-sans">
            Sequential task delegation with signed HMAC cryptographic custody handoffs between specialized roles.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            <Lock className="h-2.5 w-2.5" />
            HMAC Chain Verified
          </span>
        </div>
      </div>

      {/* Six-Agent Chain Horizontal Flow */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
        {agents.map((agent, index) => {
          const isSelected = agent.id === currentId;
          const Icon = AGENT_ICONS[agent.id] ?? Bot;

          return (
            <div key={agent.id} className="relative flex flex-col">
              <button
                type="button"
                onClick={() => handleSelect(agent.id)}
                className={cn(
                  "w-full text-left rounded-xl p-3 border transition-all duration-150 flex flex-col justify-between h-full group",
                  isSelected
                    ? "bg-blue-50/50 border-blue-500 ring-2 ring-blue-500/20 shadow-xs"
                    : "bg-slate-50/60 border-slate-200/80 hover:bg-white hover:border-slate-300"
                )}
              >
                {/* Top Role Header */}
                <div className="flex items-center justify-between gap-1 mb-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border",
                        isSelected
                          ? "border-blue-300 bg-blue-100 text-blue-700"
                          : "border-slate-200 bg-white text-slate-600 group-hover:text-slate-900"
                      )}
                    >
                      <Icon className="h-3 w-3" />
                    </span>
                    <span className="font-mono text-[10px] font-bold uppercase text-slate-500">
                      Hop {agent.order}
                    </span>
                  </div>

                  <span
                    className={cn(
                      "font-mono text-[9px] font-bold uppercase px-1.5 py-0.2 rounded border",
                      agent.status === "done"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : agent.status === "running"
                        ? "border-blue-200 bg-blue-50 text-blue-700 animate-pulse"
                        : agent.status === "contained"
                        ? "border-rose-200 bg-rose-50 text-rose-700"
                        : "border-slate-200 bg-slate-50 text-slate-500"
                    )}
                  >
                    {agent.status}
                  </span>
                </div>

                {/* Name & Role */}
                <div className="space-y-0.5 my-1">
                  <p className="font-mono text-xs font-bold text-slate-900 truncate group-hover:text-blue-600">
                    {agent.name}
                  </p>
                  <p className="text-[10.5px] text-slate-600 line-clamp-1">
                    {agent.role}
                  </p>
                </div>

                {/* Bottom Tools Chip */}
                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between gap-1 font-mono text-[9.5px] text-slate-500">
                  <span className="truncate flex items-center gap-1">
                    <Wrench className="h-2.5 w-2.5 text-slate-400" />
                    {agent.tools.length} Tools
                  </span>
                  {agent.hmacVerified && (
                    <span className="text-blue-600 flex items-center gap-0.5">
                      <Lock className="h-2 w-2" />
                      HMAC
                    </span>
                  )}
                </div>
              </button>

              {/* Connecting arrow indicator for desktop */}
              {index < agents.length - 1 && (
                <div className="hidden lg:block absolute -right-2 top-1/2 -translate-y-1/2 z-10 pointer-events-none text-slate-400">
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected Agent CrewAI Inspector Card */}
      {selectedAgent && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3 mt-2">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-2.5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-blue-200 bg-blue-100 text-blue-700">
                {(() => {
                  const CurrentIcon = AGENT_ICONS[selectedAgent.id] ?? Bot;
                  return <CurrentIcon className="h-4 w-4" />;
                })()}
              </span>
              <div>
                <h4 className="font-mono text-xs font-bold text-slate-900">
                  {selectedAgent.name} · {selectedAgent.role}
                </h4>
                <p className="text-xs text-slate-500">
                  Agent ID: <span className="font-mono text-slate-700">{selectedAgent.id}</span> · Order in Chain: {selectedAgent.order} of 6
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 font-mono text-[10px] text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                <KeyRound className="h-3 w-3 text-blue-600" />
                HMAC Signed Receiver
              </span>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            {/* Goal & Backstory */}
            <div className="rounded-lg border border-slate-200/80 bg-white p-3 space-y-1.5 shadow-2xs">
              <span className="font-mono text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-blue-600" />
                Operational Goal
              </span>
              <p className="text-slate-700 text-xs leading-relaxed font-sans">
                {selectedAgent.goal}
              </p>
              <div className="pt-1.5 border-t border-slate-100">
                <span className="font-mono text-[9.5px] uppercase font-semibold text-slate-400">
                  Backstory:
                </span>
                <p className="text-slate-600 text-[11px] leading-relaxed italic mt-0.5 font-sans">
                  &ldquo;{selectedAgent.backstory}&rdquo;
                </p>
              </div>
            </div>

            {/* Context Handoff */}
            <div className="rounded-lg border border-slate-200/80 bg-white p-3 space-y-2 shadow-2xs">
              <span className="font-mono text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                <FileText className="h-3 w-3 text-indigo-600" />
                CrewAI Task Context Passing
              </span>
              <div className="space-y-1.5">
                <div>
                  <span className="font-mono text-[9.5px] text-slate-400 uppercase">Input Context (Ingested):</span>
                  <p className="font-mono text-[11px] text-slate-800 font-semibold truncate bg-slate-50 p-1.5 rounded border border-slate-100 mt-0.5">
                    {selectedAgent.contextInput}
                  </p>
                </div>
                <div>
                  <span className="font-mono text-[9.5px] text-slate-400 uppercase">Output Context (Delegated):</span>
                  <p className="font-mono text-[11px] text-blue-800 font-semibold truncate bg-blue-50/50 p-1.5 rounded border border-blue-100 mt-0.5">
                    {selectedAgent.contextOutput}
                  </p>
                </div>
              </div>
            </div>

            {/* Tools & Cryptographic State */}
            <div className="rounded-lg border border-slate-200/80 bg-white p-3 space-y-2 shadow-2xs">
              <span className="font-mono text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                <Wrench className="h-3 w-3 text-amber-600" />
                Equipped Agent Tools ({selectedAgent.tools.length})
              </span>
              <div className="flex flex-wrap gap-1">
                {selectedAgent.tools.map((tool) => (
                  <span
                    key={tool}
                    className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[10px] text-slate-700"
                  >
                    {tool}
                  </span>
                ))}
              </div>
              <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10.5px] font-mono text-slate-500">
                <span>Execution Mode:</span>
                <span className="font-bold text-slate-800">Sequential &amp; HMAC-Gated</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
