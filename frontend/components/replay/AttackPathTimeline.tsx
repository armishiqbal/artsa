"use client";

import { useMemo, useState } from "react";
import {
  ShieldAlert,
  Search,
  Clock,
  ArrowRight,
  AlertTriangle,
  Lock,
  CheckCircle2,
  Terminal,
  Database,
  FileCheck,
  Zap,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface AttackHop {
  index: number;
  toolName: string;
  risk: number | null;
  verdict: string;
  timestamp: string;
  latency_ms?: number | null;
}

function hopTacticLabel(tool: string, verdict: string): string {
  void tool;
  return verdict.toUpperCase() === "UNCLASSIFIED"
    ? "No tactic classification recorded"
    : `Backend verdict: ${verdict}`;
}

function toolIcon(tool: string, verdict: string) {
  const v = verdict.toUpperCase();
  const t = tool.toLowerCase();
  if (v === "BREACHED" || t.includes("shell") || t.includes("exec")) return Terminal;
  if (v === "CONTAINED" || t.includes("circuit") || t.includes("containment")) return Lock;
  if (t.includes("sql") || t.includes("db") || t.includes("database")) return Database;
  if (t.includes("patch") || t.includes("rule")) return FileCheck;
  return Search;
}

function hopTone(verdict: string, risk: number | null) {
  const v = verdict.toUpperCase();
  if (v === "BREACHED" || (risk != null && risk >= 75)) {
    return {
      dot: "bg-rose-500 ring-rose-200",
      pill: "border-rose-200 bg-rose-50 text-rose-700",
      icon: ShieldAlert,
      badge: "BREACHED",
    };
  }
  if (v === "SUSPICIOUS" || (risk != null && risk >= 40)) {
    return {
      dot: "bg-amber-500 ring-amber-200",
      pill: "border-amber-200 bg-amber-50 text-amber-700",
      icon: AlertTriangle,
      badge: "SUSPICIOUS",
    };
  }
  if (v === "CONTAINED") {
    return {
      dot: "bg-blue-500 ring-blue-200",
      pill: "border-blue-200 bg-blue-50 text-blue-700",
      icon: Lock,
      badge: "CONTAINED",
    };
  }
  if (v === "SAFE" || v === "ALLOW") {
    return {
      dot: "bg-emerald-500 ring-emerald-200",
      pill: "border-emerald-200 bg-emerald-50 text-emerald-700",
      icon: CheckCircle2,
      badge: v,
    };
  }
  return {
    dot: "bg-slate-400 ring-slate-200",
    pill: "border-slate-200 bg-slate-50 text-slate-600",
    icon: Search,
    badge: "UNCLASSIFIED",
  };
}

export function AttackPathTimeline({
  hops,
  selectedIndex,
  onSelectHop,
}: {
  hops: AttackHop[];
  selectedIndex: number;
  onSelectHop: (index: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "breached" | "anomalous">("all");

  const filteredHops = useMemo(() => {
    const q = query.trim().toLowerCase();
    return hops.filter((h) => {
      if (filter === "breached" && h.verdict.toUpperCase() !== "BREACHED") return false;
      if (
        filter === "anomalous" &&
        h.verdict.toUpperCase() !== "BREACHED" &&
        h.verdict.toUpperCase() !== "SUSPICIOUS" &&
        !(h.risk != null && h.risk >= 40)
      ) return false;
      if (q && !h.toolName.toLowerCase().includes(q) && !h.verdict.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [hops, query, filter]);

  const breachCount = hops.filter((h) => h.verdict.toUpperCase() === "BREACHED").length;
  const breachHop = hops.find((h) => h.verdict.toUpperCase() === "BREACHED");

  return (
    <div className="flex flex-col rounded-xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden h-full">
      {/* Header and Filter Strip */}
      <div className="border-b border-slate-100 bg-slate-50/70 p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-800">
              Attack Path Execution Chain
            </h2>
            <p className="text-[11px] text-slate-500">Chronological agent execution hops</p>
          </div>
          <Badge variant="outline" className="font-mono text-[10px] uppercase border-slate-200 bg-white">
            {hops.length} Hops
          </Badge>
        </div>

        {/* Quick Jump Action if breach detected */}
        {breachHop && (
          <button
            type="button"
            onClick={() => onSelectHop(breachHop.index)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50/80 text-[11px] font-mono text-rose-800 hover:bg-rose-100/80 transition-colors"
          >
            <span className="flex items-center gap-1.5 font-bold">
              <Zap className="h-3 w-3 text-rose-600" />
              Jump to Critical Breach (Hop {breachHop.index + 1})
            </span>
            <span className="font-bold tabular-nums">{breachHop.risk == null ? "Risk —" : `${breachHop.risk.toFixed(0)} Risk`}</span>
          </button>
        )}

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={cn(
              "rounded-lg px-2.5 py-1 font-mono text-[10.5px] font-medium transition-colors",
              filter === "all"
                ? "bg-slate-900 text-white shadow-2xs"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            )}
          >
            All ({hops.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("breached")}
            className={cn(
              "rounded-lg px-2.5 py-1 font-mono text-[10.5px] font-medium transition-colors",
              filter === "breached"
                ? "bg-rose-600 text-white shadow-2xs"
                : "bg-white text-rose-700 border border-rose-200 hover:bg-rose-50"
            )}
          >
            Breaches ({breachCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter("anomalous")}
            className={cn(
              "rounded-lg px-2.5 py-1 font-mono text-[10.5px] font-medium transition-colors",
              filter === "anomalous"
                ? "bg-amber-600 text-white shadow-2xs"
                : "bg-white text-amber-700 border border-amber-200 hover:bg-amber-50"
            )}
          >
            Elevated
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search hop tool or verdict…"
            className="h-7.5 border-slate-200 bg-white pl-8 font-mono text-xs text-slate-900 placeholder:text-slate-400 focus-visible:ring-blue-500"
          />
        </div>
      </div>

      {/* Vertical Execution Chain */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredHops.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            No execution hops match the current filter.
          </div>
        ) : (
          filteredHops.map((hop, index) => {
            const isSelected = selectedIndex === hop.index;
            const tactic = hopTacticLabel(hop.toolName, hop.verdict);
            const tone = hopTone(hop.verdict, hop.risk);
            const Icon = tone.icon;
            const ToolIcon = toolIcon(hop.toolName, hop.verdict);

            return (
              <div key={hop.index} className="relative">
                {/* Connecting hairline to next hop */}
                {index < filteredHops.length - 1 && (
                  <div className="absolute left-[19px] top-[40px] bottom-[-10px] w-0.5 bg-slate-200 z-0" />
                )}

                <button
                  type="button"
                  onClick={() => onSelectHop(hop.index)}
                  className={cn(
                    "relative z-10 w-full text-left rounded-xl p-3 border transition-all duration-150 flex items-start gap-3",
                    isSelected
                      ? "bg-white border-blue-500 ring-2 ring-blue-500/20 shadow-xs"
                      : "bg-slate-50/50 border-slate-200/80 hover:bg-white hover:border-slate-300"
                  )}
                >
                  {/* Status Indicator Dot */}
                  <span
                    className={cn(
                      "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ring-4",
                      tone.dot
                    )}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  </span>

                  {/* Hop Details */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Hop {hop.index + 1}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[9.5px] font-bold uppercase",
                          tone.pill
                        )}
                      >
                        <Icon className="h-2.5 w-2.5" />
                        {tone.badge}{hop.risk == null ? "" : ` · ${hop.risk.toFixed(0)}`}
                      </span>
                    </div>

                    <p className="font-mono text-xs font-bold text-slate-900 truncate flex items-center gap-1.5">
                      <ToolIcon className="h-3 w-3 text-slate-500 shrink-0" />
                      {hop.toolName}
                    </p>

                    <p className="text-[11px] text-slate-600 truncate">
                      {tactic}
                    </p>

                    <div className="flex items-center gap-2 pt-0.5 font-mono text-[9.5px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {new Date(hop.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </span>
                      {typeof hop.latency_ms === "number" && (
                        <span>• {hop.latency_ms}ms</span>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <ArrowRight className="h-3.5 w-3.5 text-blue-600 shrink-0 self-center" />
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
