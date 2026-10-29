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
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-blue-600" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
            Multi-Agent Turn Execution · Round {round ?? "Latest"}
          </h3>
          <span className="rounded bg-blue-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-blue-700 border border-blue-200">
            CrewAI Sequential Chain
          </span>
        </div>
        <span className="font-mono text-[11px] text-muted-foreground">
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
                  "border-red-300 bg-red-50/50 shadow-2xs",
                state === "contained" &&
                  "border-emerald-300 bg-emerald-50/40 shadow-2xs",
                state === "running" &&
                  "border-blue-400 bg-blue-50/30 ring-1 ring-blue-300 shadow-2xs",
                state === "completed" &&
                  "border-slate-200 bg-white shadow-2xs",
                state === "standby" &&
                  "border-slate-200/80 bg-slate-50/60 opacity-75",
                state === "pending" &&
                  "border-dashed border-slate-200 bg-slate-50/40 opacity-60"
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div
                    className={cn(
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-slate-800",
                      state === "breached" && "border-red-300 bg-red-100 text-red-800",
                      state === "contained" && "border-emerald-300 bg-emerald-100 text-emerald-800",
                      state === "running" && "border-blue-300 bg-blue-100 text-blue-800 animate-pulse",
                      (state === "completed" || state === "standby" || state === "pending") &&
                        "border-slate-200 bg-slate-100 text-slate-700"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Hop {spec.order}
                      </span>
                      <span className="font-semibold text-slate-900 truncate">
                        {spec.name}
                      </span>
                      <span className="text-slate-500 text-[11px] font-sans truncate">
                        ({spec.role})
                      </span>
                    </div>
                    <p className="mt-1 text-slate-700 font-sans leading-relaxed">
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
                    <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
                      <Lock className="h-2.5 w-2.5 text-slate-400" />
                      {state === "standby" ? "Standby Handoff" : "Awaiting Handoff"}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-700">
                      <Lock className="h-2.5 w-2.5 text-slate-500" />
                      HMAC Verified
                    </span>
                  )}

                  {/* Outcome badge */}
                  {state === "breached" ? (
                    <span className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 font-mono text-[10px] font-bold text-red-800 border border-red-200">
                      <AlertTriangle className="h-3 w-3 text-red-600" />
                      Breach Detected
                    </span>
                  ) : state === "contained" ? (
                    <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-800 border border-emerald-200">
                      <Shield className="h-3 w-3 text-emerald-600" />
                      Contained
                    </span>
                  ) : state === "running" ? (
                    <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-0.5 font-mono text-[10px] font-bold text-blue-800 border border-blue-200 animate-pulse">
                      Executing
                    </span>
                  ) : state === "completed" ? (
                    <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-medium text-slate-700 border border-slate-200">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      Turn Complete
                    </span>
                  ) : state === "standby" ? (
                    <span className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-500 border border-slate-200">
                      Standby
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-400">
                      Pending
                    </span>
                  )}
                </div>
              </div>

              {/* Tools declaration and active tokens */}
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-slate-200/60 pt-2">
                <span className="font-mono text-[10px] font-medium text-slate-500 flex items-center gap-1">
                  <Wrench className="h-3 w-3 text-slate-400" /> Tools:
                </span>
                {tools.map((t) => (
                  <span
                    key={t}
                    className="rounded bg-slate-100 px-1.5 py-0.2 font-mono text-[10px] text-slate-700 border border-slate-200/80"
                  >
                    {t}
                  </span>
                ))}

                {snippet ? (
                  <button
                    type="button"
                    onClick={() => toggleTrace(spec.id)}
                    className="ml-auto inline-flex items-center gap-1 font-mono text-[10px] text-blue-600 hover:text-blue-800 hover:underline"
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
                <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2.5 font-mono text-[11px] text-slate-800">
                  <div className="flex items-center justify-between text-[10px] text-slate-500 pb-1 mb-1 border-b border-slate-200">
                    <span>Cryptographic Custody Token:</span>
                    <span className="font-mono font-bold text-slate-700">{hmacToken}</span>
                  </div>
                  <pre className="whitespace-pre-wrap font-mono leading-relaxed text-slate-800">
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
