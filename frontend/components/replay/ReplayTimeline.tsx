"use client";

import { cn } from "@/lib/utils";
import { severityFromScore } from "@/lib/severity";

export interface TimelineEntryView {
  index: number;
  toolName: string;
  risk: number;
  verdict: string;
  timestamp: string;
}

function formatTime(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "—";
  }
}

function barColor(risk: number): string {
  const sev = severityFromScore(risk);
  if (sev === "CRITICAL") return "bg-severity-critical";
  if (sev === "HIGH") return "bg-severity-high";
  if (sev === "MEDIUM") return "bg-severity-medium";
  return "bg-muted-foreground/40";
}

export function ReplayRiskStrip({
  entries,
  selectedIndex,
  onSelect,
}: {
  entries: TimelineEntryView[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  if (entries.length === 0) return null;

  return (
    <div className="border-b border-border px-4 py-3 sm:px-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">Risk across session</p>
        <p className="font-mono text-[10px] text-muted-foreground tabular-nums">
          {entries.length} events
        </p>
      </div>
      <div className="mt-2 flex items-end gap-0.5" role="list" aria-label="Session risk timeline">
        {entries.map((e) => {
          const height = Math.max(12, Math.round((e.risk / 100) * 40));
          const selected = selectedIndex === e.index;
          return (
            <button
              key={e.index}
              type="button"
              role="listitem"
              onClick={() => onSelect(e.index)}
              title={`${e.toolName} · ${e.risk.toFixed(0)} · ${e.verdict}`}
              className={cn(
                "group flex-1 min-w-[4px] rounded-sm transition-all duration-200",
                barColor(e.risk),
                selected ? "ring-2 ring-foreground ring-offset-1 ring-offset-background opacity-100" : "opacity-70 hover:opacity-100"
              )}
              style={{ height }}
              aria-current={selected ? "true" : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}

export function ReplayEventList({
  entries,
  selectedIndex,
  onSelect,
}: {
  entries: TimelineEntryView[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <ul className="divide-y divide-border" role="listbox" aria-label="Timeline events">
      {entries.map((e) => {
        const selected = selectedIndex === e.index;
        const sev = severityFromScore(e.risk);
        return (
          <li key={e.index}>
            <button
              type="button"
              onClick={() => onSelect(e.index)}
              aria-current={selected ? "true" : undefined}
              className={cn(
                "interactive-row flex w-full items-center gap-3 px-3 py-2.5 text-left",
                selected && "bg-muted/75"
              )}
            >
              <span className="w-6 shrink-0 font-mono text-[10px] text-muted-foreground tabular-nums">
                {e.index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{e.toolName}</p>
                <p className="font-mono text-[10px] text-muted-foreground">{formatTime(e.timestamp)}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span
                  className={cn(
                    "font-mono text-xs font-semibold tabular-nums",
                    sev === "CRITICAL" && "text-severity-critical",
                    sev === "HIGH" && "text-severity-high",
                    sev === "MEDIUM" && "text-severity-medium",
                    sev === "LOW" && "text-muted-foreground"
                  )}
                >
                  {Number.isFinite(e.risk) ? e.risk.toFixed(0) : "—"}
                </span>
                <span className="text-[10px] text-muted-foreground">{e.verdict}</span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
