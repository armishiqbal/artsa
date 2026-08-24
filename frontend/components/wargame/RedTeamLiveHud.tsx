"use client";

import { Activity, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { LiveIndicator } from "@/components/shared/LiveIndicator";
import { cn } from "@/lib/utils";

interface RedTeamLiveHudProps {
  running: boolean;
  status: string;
  roundsCompleted: number;
  maxRounds: number;
  progressPct: number;
  targetName?: string | null;
  scanModeLabel?: string;
  className?: string;
}

function RoundTimeline({ total, completed }: { total: number; completed: number }) {
  if (total <= 0) return null;
  const capped = Math.min(total, 24);
  return (
    <div className="flex flex-wrap gap-1" aria-label={`Round progress ${completed} of ${total}`}>
      {Array.from({ length: capped }, (_, i) => {
        const filled = i < completed;
        const active = i === completed && completed < total;
        return (
          <span
            key={i}
            className={cn(
              "h-1.5 w-2.5 rounded-full transition-all duration-300",
              filled ? "bg-foreground" : active ? "bg-foreground/50 animate-pulse" : "bg-border"
            )}
          />
        );
      })}
      {total > 24 && (
        <span className="font-mono text-[10px] text-muted-foreground">+{total - 24}</span>
      )}
    </div>
  );
}

/** Lakera-style live scan progress strip during campaign execution. */
export function RedTeamLiveHud({
  running,
  status,
  roundsCompleted,
  maxRounds,
  progressPct,
  targetName,
  scanModeLabel,
  className,
}: RedTeamLiveHudProps) {
  if (!running && status !== "failed") return null;

  return (
    <div
      className={cn(
        "border-b border-border bg-muted/15 px-4 py-3",
        status === "failed" && "bg-destructive/5",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {running ? (
            <LiveIndicator connected label="Scan in progress" className="meta-badge" />
          ) : (
            <Badge variant="destructive" className="meta-badge">Scan failed</Badge>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {running ? "Adversarial scan running" : "Scan terminated"}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {targetName ?? "Target"} · {scanModeLabel ?? "Evaluation"}
            </p>
          </div>
        </div>
        {running && (
          <div className="flex items-center gap-2 font-mono text-xs tabular-nums text-muted-foreground">
            <Activity className="h-3.5 w-3.5" aria-hidden />
            Round {roundsCompleted}/{maxRounds || "—"}
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          </div>
        )}
      </div>
      {running && maxRounds > 0 && (
        <div className="mt-3 space-y-2">
          <Progress value={progressPct} className="h-1.5" />
          <RoundTimeline total={maxRounds} completed={roundsCompleted} />
        </div>
      )}
    </div>
  );
}
