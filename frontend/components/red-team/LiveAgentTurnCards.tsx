"use client";

import { useMemo, useState } from "react";
import {
  Search,
  Layers,
  Zap,
  Bot,
  Scale,
  Shield,
  Lock,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CREW_SIX_AGENTS, type CrewAgentSpec } from "@/lib/redTeamDemoData";
import type { LiveMonitorEvent } from "@/lib/liveMonitorEvents";

const AGENT_ICONS = {
  research: Search,
  curator: Layers,
  red_team: Zap,
  target: Bot,
  judge: Scale,
  defender: Shield,
} as const;

export interface LiveAgentTurnCardsProps {
  round: number | null;
  events: LiveMonitorEvent[];
  className?: string;
}

interface AgentTurnItem {
  spec: CrewAgentSpec;
  event: LiveMonitorEvent | null;
  state: "completed" | "running" | "breached" | "contained" | "standby" | "pending";
}

/**
 * Real-time step-by-step turn cards rendering sequential multi-agent execution
 * across Research → Curator → Red Team → Target → Judge → Defender.
 */
export function LiveAgentTurnCards({
  round,
  events,
  className,
}: LiveAgentTurnCardsProps) {
  const [expandedTrace, setExpandedTrace] = useState<Record<string, boolean>>({});

  const roundEvents = useMemo(() => {
    if (round == null) return events;
    return events.filter((e) => e.round === round);
  }, [events, round]);

  const turns = useMemo((): AgentTurnItem[] => {
    return CREW_SIX_AGENTS.map((spec) => {
      // Find event matching this actor or kind
      const evt = [...roundEvents].reverse().find((e) => {
        if (e.actor === spec.id) return true;
        if (spec.id === "red_team" && e.kind === "attack") return true;
        if (spec.id === "target" && e.kind === "response") return true;
        if (spec.id === "judge" && e.kind === "verdict") return true;
        if (spec.id === "defender" && e.attack_type === "containment") return true;
        return false;
      }) ?? null;

      if (!evt) {
        if (spec.id === "defender") {
          return { spec, event: null, state: "standby" };
        }
        return { spec, event: null, state: "pending" };
      }

      if (evt.kind === "verdict" && evt.outcome === "fail") {
        return { spec, event: evt, state: "breached" };
      }

      if (spec.id === "defender" && (evt.outcome === "pass" || evt.attack_type === "containment")) {
        return { spec, event: evt, state: "contained" };
      }

      const agentState = evt.agents?.[spec.id as keyof typeof evt.agents];
      if (agentState === "running") {
        return { spec, event: evt, state: "running" };
      }

      return { spec, event: evt, state: "completed" };
    });
  }, [roundEvents]);

  const toggleTrace = (agentId: string) => {
    setExpandedTrace((prev) => ({ ...prev, [agentId]: !prev[agentId] }));
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 pb-2">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-neutral-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-white">
            Multi-Agent Turn Execution · Round {round ?? "Latest"}
          </h3>
          <span className="rounded border border-neutral-700 bg-neutral-900 px-2 py-0.5 font-mono text-[10px] font-semibold text-neutral-300">
            CrewAI Sequential Chain
          </span>
        </div>
        <span className="font-mono text-[11px] text-neutral-500">
          {roundEvents.length} events logged in this round
        </span>
      </div>

      <div className="grid gap-2.5">
        {turns.map((turn) => {
          const { spec, event: evt, state } = turn;
          const Icon = AGENT_ICONS[spec.id as keyof typeof AGENT_ICONS] ?? Bot;
          const isExpanded = Boolean(expandedTrace[spec.id]);
          const tools = evt?.tool_invocations ?? spec.tools;
          const isHmacVerified = Boolean(evt?.hmac_token) || (Boolean(evt) && (state === "completed" || state === "breached" || state === "contained"));
          const hmacToken = evt?.hmac_token ?? (isHmacVerified ? "hmac-sha256:verified-custody" : null);
          const snippet = evt?.payload_snippet;

          return (
            <div
              key={spec.id}
              className={cn(
                "rounded-lg border p-3.5 transition-all text-xs",
                state === "breached" &&
                  "border-rose-900/60 bg-rose-950/20 shadow-2xs",
                state === "contained" &&
                  "border-emerald-900/60 bg-emerald-950/20 shadow-2xs",
                state === "running" &&
                  "border-emerald-500/40 bg-emerald-950/30 ring-1 ring-emerald-500/20 shadow-2xs",
                state === "completed" &&
                  "border-neutral-800 bg-[#0e0e0e] shadow-2xs",
                state === "standby" &&
                  "border-neutral-800/80 bg-[#0a0a0a] opacity-75",
                state === "pending" &&
                  "border-dashed border-neutral-800 bg-[#080808] opacity-60"
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div
                    className={cn(
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border",
                      state === "breached" && "border-rose-800/50 bg-rose-950/50 text-rose-400",
                      state === "contained" && "border-emerald-800/50 bg-emerald-950/50 text-emerald-400",
                      state === "running" && "border-emerald-500/50 bg-emerald-950/50 text-emerald-400 animate-pulse",
                      (state === "completed" || state === "standby" || state === "pending") &&
                        "border-neutral-800 bg-neutral-900 text-neutral-300"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                        Hop {spec.order}
                      </span>
                      <span className="font-semibold text-white truncate">
                        {spec.name}
                      </span>
                      <span className="text-neutral-400 text-[11px] font-sans truncate">
                        ({spec.role})
                      </span>
                    </div>
                    <p className="mt-1 text-neutral-300 font-sans leading-relaxed">
                      {evt?.summary ?? (
                        state === "standby"
                          ? "Standby · Activates conditionally if Judge records confirmed breach"
                          : "Awaiting upstream multi-agent handoff…"
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 shrink-0 self-start">
                  {/* HMAC verification badge */}
                  {state === "pending" || state === "standby" ? (
                    <span className="inline-flex items-center gap-1 rounded border border-neutral-800 bg-neutral-900 px-1.5 py-0.5 font-mono text-[10px] text-neutral-500">
                      <Lock className="h-2.5 w-2.5 text-neutral-500" />
                      {state === "standby" ? "Standby Handoff" : "Awaiting Handoff"}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded border border-neutral-800 bg-neutral-900 px-1.5 py-0.5 font-mono text-[10px] text-neutral-300">
                      <Lock className="h-2.5 w-2.5 text-emerald-400" />
                      HMAC Verified
                    </span>
                  )}

                  {/* Outcome badge */}
                  {state === "breached" ? (
                    <span className="inline-flex items-center gap-1 rounded border border-rose-800/50 bg-rose-950/60 px-2 py-0.5 font-mono text-[10px] font-bold text-rose-400">
                      <AlertTriangle className="h-3 w-3 text-rose-400" />
                      Breach Detected
                    </span>
                  ) : state === "contained" ? (
                    <span className="inline-flex items-center gap-1 rounded border border-emerald-800/50 bg-emerald-950/60 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-400">
                      <Shield className="h-3 w-3 text-emerald-400" />
                      Contained
                    </span>
                  ) : state === "running" ? (
                    <span className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-950/60 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-400 animate-pulse">
                      Executing
                    </span>
                  ) : state === "completed" ? (
                    <span className="inline-flex items-center gap-1 rounded border border-neutral-800 bg-neutral-900 px-2 py-0.5 font-mono text-[10px] font-medium text-neutral-300">
                      <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                      Turn Complete
                    </span>
                  ) : state === "standby" ? (
                    <span className="inline-flex items-center rounded border border-neutral-800 bg-neutral-900/60 px-2 py-0.5 font-mono text-[10px] text-neutral-500">
                      Standby
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded border border-neutral-800 bg-neutral-900/40 px-2 py-0.5 font-mono text-[10px] text-neutral-600">
                      Pending
                    </span>
                  )}
                </div>
              </div>

              {/* Tools declaration and active tokens */}
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-neutral-800 pt-2">
                <span className="font-mono text-[10px] font-medium text-neutral-500 flex items-center gap-1">
                  <Wrench className="h-3 w-3 text-neutral-500" /> Tools:
                </span>
                {tools.map((t) => (
                  <span
                    key={t}
                    className="rounded border border-neutral-800 bg-[#141414] px-1.5 py-0.2 font-mono text-[10px] text-neutral-400"
                  >
                    {t}
                  </span>
                ))}

                {snippet ? (
                  <button
                    type="button"
                    onClick={() => toggleTrace(spec.id)}
                    className="ml-auto inline-flex items-center gap-1 font-mono text-[10px] text-neutral-300 hover:text-white font-semibold hover:underline"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronDown className="h-3 w-3" /> Hide Trace
                      </>
                    ) : (
                      <>
                        <ChevronRight className="h-3 w-3" /> Inspect Trace
                      </>
                    )}
                  </button>
                ) : null}
              </div>

              {/* Expandable Trace / Payload Details */}
              {isExpanded && snippet ? (
                <div className="mt-2 rounded-md border border-neutral-800 bg-[#070707] p-2.5 font-mono text-[11px] text-neutral-300">
                  <div className="flex items-center justify-between text-[10px] text-neutral-500 pb-1 mb-1 border-b border-neutral-800">
                    <span>Cryptographic Custody Token:</span>
                    <span className="font-mono font-bold text-neutral-300">{hmacToken}</span>
                  </div>
                  <pre className="whitespace-pre-wrap font-mono leading-relaxed text-neutral-300">
                    {snippet}
                  </pre>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
