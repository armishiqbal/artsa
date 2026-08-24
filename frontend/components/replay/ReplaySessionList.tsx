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
  selectedId,
  query,
  onQueryChange,
  onSelect,
}: {
  sessions: Session[];
  loading: boolean;
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
    <div className="flex min-h-[480px] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-card lg:min-h-[640px]">
      <div className="space-y-3 border-b border-border p-3">
        <div>
          <p className="text-sm font-medium">Sessions</p>
          <p className="text-[11px] text-muted-foreground">{sessions.length} available</p>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search agent or ID…"
            className="h-8 pl-8 text-xs"
            aria-label="Search sessions"
          />
        </div>
      </div>
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="space-y-2 p-3">
            {[1, 2, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-center text-xs text-muted-foreground">
            {sessions.length === 0 ? "No sessions yet." : "No matches."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((s) => {
              const selected = selectedId === s.id;
              const maxSeverity = severityFromScore(s.max_risk_score);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(s.id)}
                    className={cn(
                      "interactive-row flex w-full flex-col gap-1.5 px-3 py-3 text-left",
                      selected && "border-l-2 border-l-foreground bg-muted/75 pl-[10px]"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-mono text-xs font-medium">{s.agent_id}</span>
                      <Badge variant={sessionStatusVariant(s.status)} className="shrink-0 text-[10px]">
                        {s.status}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <SeverityBadge severity={maxSeverity} />
                      <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                        {s.tool_call_count} events
                      </span>
                      {s.containment_breaches > 0 && (
                        <span className="font-mono text-[10px] text-severity-critical tabular-nums">
                          {s.containment_breaches} breaches
                        </span>
                      )}
                    </div>
                    <p className="truncate font-mono text-[10px] text-muted-foreground">{s.id}</p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>
    </div>
  );
}
