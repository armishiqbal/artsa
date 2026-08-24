"use client";

import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function LayerScoresPanel({ scores }: { scores: Record<string, number> }) {
  const rows = Object.entries(scores)
    .filter(([, v]) => Number.isFinite(v) && v > 0)
    .sort((a, b) => b[1] - a[1]);

  if (rows.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-muted/15 p-4">
      <h4 className="text-[10px] font-semibold text-muted-foreground">
        Which checks added to the danger score
      </h4>
      <div className="mt-3 space-y-2">
        {rows.map(([key, value]) => (
          <div key={key} className="space-y-1">
            <div className="flex justify-between font-mono text-[11px]">
              <span className="text-muted-foreground">{key.replace(/_/g, " ")}</span>
              <span className="tabular-nums">{value.toFixed(1)}</span>
            </div>
            <Progress
              value={Math.min(100, value)}
              className={cn("h-1.5", value >= 70 && "[&>div]:bg-severity-high")}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

interface SecurityEvent {
  event_type: string;
  severity: string;
  risk_score: number;
  description: string;
  detector: string;
}

export function SecurityEventsTable({ events }: { events: SecurityEvent[] }) {
  if (!events.length) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/30 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2">Detector</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Severity</th>
            <th className="px-3 py-2">Risk</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border font-mono">
          {events.map((e, i) => (
            <tr key={`${e.detector}-${i}`} className="interactive-row">
              <td className="px-3 py-2 text-muted-foreground">{e.detector}</td>
              <td className="px-3 py-2">{e.event_type}</td>
              <td className="px-3 py-2">
                <Badge variant="secondary" className="text-[10px]">{e.severity}</Badge>
              </td>
              <td className="px-3 py-2 tabular-nums">{e.risk_score.toFixed(0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
