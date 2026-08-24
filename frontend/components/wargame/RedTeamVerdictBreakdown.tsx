"use client";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface RedTeamVerdictBreakdownProps {
  verdicts: Record<string, number>;
  className?: string;
}

function verdictBarClass(verdict: string): string {
  const v = verdict.toUpperCase();
  if (v.includes("SUCCESS")) return "[&>div]:bg-severity-high";
  if (v.includes("PARTIAL")) return "[&>div]:bg-severity-medium";
  if (v.includes("BLOCKED")) return "[&>div]:bg-status-success";
  return "";
}

/** Horizontal verdict distribution — Lakera results overview. */
export function RedTeamVerdictBreakdown({ verdicts, className }: RedTeamVerdictBreakdownProps) {
  const entries = Object.entries(verdicts).filter(([, n]) => n > 0);
  const total = entries.reduce((acc, [, n]) => acc + n, 0);

  if (!entries.length) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <p className="section-label">Verdict distribution</p>
      <div className="space-y-2">
        {entries.map(([verdict, count]) => {
          const pct = Math.round((count / total) * 100);
          return (
            <div key={verdict} className="space-y-1">
              <div className="flex justify-between font-mono text-[11px]">
                <span className="text-muted-foreground">{verdict}</span>
                <span className="tabular-nums text-foreground">{count} · {pct}%</span>
              </div>
              <Progress value={pct} className={cn("h-1.5", verdictBarClass(verdict))} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
