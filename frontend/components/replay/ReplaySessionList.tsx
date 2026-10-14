"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import type { Session } from "@/lib/types";
import { severityFromScore } from "@/lib/severity";
import { cn } from "@/lib/utils";

function sessionStatusVariant(status: Session["status"]): "success" | "critical" | "warning" | "secondary" {
  if (status === "BREACHED") return "critical";
  if (status === "QUARANTINED") return "warning";
  if (status === "ACTIVE") return "success";
  return "secondary";
}

export function ReplaySessionList({
  sessions,
  loading,
  source,
  selectedId,
  query,
  onQueryChange,
  onSelect,
}: {
  sessions: Session[];
  loading: boolean;
  source: "live" | "walkthrough";
  selectedId: string | null;
  query: string;
  onQueryChange: (q: string) => void;
  onSelect: (id: string) => void;
}) {
  const filtered = sessions.filter((s) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return s.id.toLowerCase().includes(q) || s.agent_id.toLowerCase().includes(q);
  });

  return (
    <section aria-label="Session navigator" className="flex min-h-[360px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-4 lg:max-h-[calc(100vh-10rem)]">
      <div className="border-b border-slate-200 px-4 py-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Evidence library</p>
            <h2 className="mt-1 text-sm font-semibold text-slate-950">Recorded sessions</h2>
          </div>
          <span className={cn("rounded-full border px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-wide", source === "live" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800")}>
            {source === "live" ? "API" : "Sample"}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">{sessions.length} {sessions.length === 1 ? "session" : "sessions"}</p>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Find agent or session…"
            className="mt-3 h-9 border-slate-200 bg-slate-50 pl-8 text-xs placeholder:text-slate-400"
            aria-label="Search sessions"
          />
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        {loading ? (
          <div className="space-y-2 p-3">
            {[1, 2, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-center text-xs text-slate-500">
            {sessions.length === 0 ? "No sessions yet." : "No matches."}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((s) => {
              const selected = selectedId === s.id;
              const maxSeverity = severityFromScore(s.max_risk_score);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(s.id)}
                    className={cn(
                      "flex w-full flex-col gap-2 border-l-2 border-transparent px-4 py-3.5 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-600",
                      selected && "border-l-[#b1e84f] bg-slate-950 pl-3.5 text-white hover:bg-slate-900"
                    )}
                    aria-pressed={selected}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("truncate font-mono text-xs font-semibold", selected ? "text-white" : "text-slate-900")}>{s.agent_id}</span>
                      <Badge variant={sessionStatusVariant(s.status)} className="shrink-0 text-[9px]">
                        {s.status}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <SeverityBadge severity={maxSeverity} />
                      <span className={cn("font-mono text-[10px] tabular-nums", selected ? "text-slate-300" : "text-slate-500")}>
                        {s.tool_call_count} events
                      </span>
                      {s.containment_breaches > 0 && (
                          <span className={cn("font-mono text-[10px] tabular-nums", selected ? "text-rose-300" : "text-severity-critical")}>
                          {s.containment_breaches} breaches
                        </span>
                      )}
                    </div>
                    <p className={cn("truncate font-mono text-[10px]", selected ? "text-slate-400" : "text-slate-400")}>{s.id}</p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>
    </section>
  );
}
