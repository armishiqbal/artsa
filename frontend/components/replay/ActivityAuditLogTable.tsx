"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpDown,
  ChevronRight,
  Clock,
  Download,
  Search,
  ShieldAlert,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TimelineEntry } from "@/lib/types/replay";
import type { Session } from "@/lib/types";

function recordedTarget(args: Record<string, unknown>): string | null {
  for (const key of ["target", "resource", "resource_name", "url", "path"]) {
    const value = args[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function recordedVerdict(evaluation: Record<string, unknown> | null | undefined): string {
  const verdict = evaluation?.verdict;
  return typeof verdict === "string" && verdict.trim()
    ? verdict.toUpperCase()
    : "UNCLASSIFIED";
}

function recordedRisk(evaluation: Record<string, unknown> | null | undefined): number | null {
  const score = evaluation?.risk_score;
  return typeof score === "number" && Number.isFinite(score) ? score : null;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unavailable"
    : date.toLocaleString(undefined, { timeZone: "UTC", timeZoneName: "short" });
}

function badgeFor(verdict: string) {
  if (verdict === "BREACHED" || verdict === "CRITICAL") {
    return { color: "border-rose-200 bg-rose-50 text-rose-700", icon: ShieldAlert };
  }
  if (verdict === "SUSPICIOUS" || verdict === "HIGH") {
    return { color: "border-amber-200 bg-amber-50 text-amber-700", icon: AlertTriangle };
  }
  if (verdict === "SAFE" || verdict === "CONTAINED") {
    return { color: "border-emerald-200 bg-emerald-50 text-emerald-700", icon: ShieldCheck };
  }
  return { color: "border-slate-200 bg-slate-50 text-slate-600", icon: Terminal };
}

export function ActivityAuditLogTable({
  timeline,
  sessions,
  selectedSessionId,
  onSelectSession,
  selectedEventId,
  onSelectEvent,
  onExport,
}: {
  timeline: TimelineEntry[];
  sessions: Session[];
  selectedSessionId: string | null;
  onSelectSession: (id: string) => void;
  selectedEventId: string | null;
  onSelectEvent: (entry: TimelineEntry) => void;
  onExport: () => void;
}) {
  const [search, setSearch] = useState("");
  const [verdictFilter, setVerdictFilter] = useState("ALL");

  const filteredEntries = useMemo(() => {
    const query = search.trim().toLowerCase();
    return timeline.filter((entry) => {
      const verdict = recordedVerdict(entry.evaluation);
      const target = recordedTarget(entry.event.arguments);
      const searchable = [
        entry.event.tool_name,
        entry.event.agent_id,
        entry.event.trace_id,
        target,
        JSON.stringify(entry.event.arguments),
        verdict,
      ].filter(Boolean).join(" ").toLowerCase();

      if (query && !searchable.includes(query)) return false;
      return verdictFilter === "ALL" || verdict === verdictFilter;
    });
  }, [timeline, search, verdictFilter]);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.03)]">
      <div className="space-y-3 border-b border-slate-100 bg-slate-50/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-slate-800">
              <Clock className="h-3.5 w-3.5 text-blue-600" />
              Activity &amp; Identity Audit Trail
            </h2>
            <span className="font-mono text-[10.5px] text-slate-500">
              ({filteredEntries.length} of {timeline.length} recorded events)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {sessions.length > 0 && (
              <div className="relative min-w-[240px]">
                <select
                  value={selectedSessionId ?? ""}
                  onChange={(event) => onSelectSession(event.target.value)}
                  className="h-8 w-full appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 font-mono text-xs text-slate-800 shadow-2xs outline-none hover:border-slate-300 focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {sessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.agent_id} ({session.status} · {session.tool_call_count} actions)
                    </option>
                  ))}
                </select>
                <ArrowUpDown className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 border-slate-200 bg-white font-mono text-xs text-slate-700 shadow-2xs hover:bg-slate-50"
              onClick={onExport}
            >
              <Download className="h-3 w-3 text-slate-500" />
              Export Audit
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="relative min-w-[240px] max-w-xl flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder="Search recorded action, agent, target, or payload..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-8 border-slate-200 bg-white pl-8 font-mono text-xs shadow-2xs placeholder:text-slate-400"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 font-mono text-[10px] font-bold uppercase text-slate-400">Verdict:</span>
            {["ALL", "BREACHED", "SUSPICIOUS", "CONTAINED", "SAFE", "UNCLASSIFIED"].map((verdict) => (
              <button
                key={verdict}
                type="button"
                onClick={() => setVerdictFilter(verdict)}
                className={cn(
                  "rounded-md px-2.5 py-1 font-mono text-[10.5px] font-semibold transition-colors shadow-2xs",
                  verdictFilter === verdict
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                {verdict === "ALL" ? "All" : verdict}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200/80 bg-slate-100/70 font-mono text-[10.5px] uppercase tracking-wider text-slate-600">
              <th className="px-4 py-2.5 font-bold">Timestamp (UTC)</th>
              <th className="px-4 py-2.5 font-bold">Action / Tool</th>
              <th className="px-4 py-2.5 font-bold">Recorded Target</th>
              <th className="px-4 py-2.5 font-bold">Evaluation</th>
              <th className="px-4 py-2.5 text-center font-bold">Risk Score</th>
              <th className="px-4 py-2.5 text-right font-bold">Inspect</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-sans">
            {filteredEntries.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center font-mono text-xs italic text-slate-400">
                  No activity records matched the active filters.
                </td>
              </tr>
            ) : filteredEntries.map((entry, index) => {
              const { event, evaluation } = entry;
              const verdict = recordedVerdict(evaluation);
              const risk = recordedRisk(evaluation);
              const target = recordedTarget(event.arguments);
              const badge = badgeFor(verdict);
              const VerdictIcon = badge.icon;
              const selected = selectedEventId === event.id;
              const traceId = typeof event.trace_id === "string" && event.trace_id.trim()
                ? event.trace_id
                : null;

              return (
                <tr
                  key={event.id}
                  onClick={() => onSelectEvent(entry)}
                  className={cn(
                    "group cursor-pointer select-none transition-colors",
                    selected ? "border-l-4 border-l-blue-600 bg-blue-50/70" : index % 2 === 0 ? "bg-white hover:bg-slate-50/80" : "bg-slate-50/30 hover:bg-slate-50/80"
                  )}
                >
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-slate-600">
                    {formatTimestamp(event.timestamp)}
                  </td>
                  <td className="min-w-[200px] px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-700">
                        <Terminal className="h-3 w-3" />
                      </span>
                      <div>
                        <p className="font-mono text-xs font-bold text-slate-900 group-hover:text-blue-600">{event.tool_name}</p>
                        <p className="font-mono text-[10px] text-slate-500">Agent: {event.agent_id || "Unavailable"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="min-w-[180px] px-4 py-3 font-mono text-xs text-slate-700">
                    {target ?? <span className="text-slate-400">Not recorded</span>}
                    {traceId && <p className="mt-1 truncate text-[10px] text-slate-400">Trace: {traceId}</p>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className={cn("inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[10px] font-bold", badge.color)}>
                      <VerdictIcon className="h-3 w-3" />
                      {verdict}
                    </span>
                    {typeof event.latency_ms === "number" && Number.isFinite(event.latency_ms) && (
                      <span className="ml-2 font-mono text-[10px] text-slate-400">{event.latency_ms} ms</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center font-mono text-xs font-semibold tabular-nums text-slate-700">
                    {risk === null ? "—" : risk.toFixed(0)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation();
                        onSelectEvent(entry);
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 font-mono text-[11px] font-semibold text-slate-700 shadow-2xs transition-colors group-hover:border-blue-300 group-hover:bg-blue-50 group-hover:text-blue-700"
                    >
                      Inspect <ChevronRight className="h-3 w-3 text-slate-400 group-hover:text-blue-600" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-2.5 font-mono text-xs text-slate-500">
        Records and evaluation fields shown here come from the selected session response.
      </div>
    </div>
  );
}
