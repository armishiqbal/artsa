"use client";

import { AgentRoleBadge } from "@/components/pipeline/AgentStatusStrip";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { TranscriptTurn } from "@/lib/campaignTranscript";

function verdictVariant(verdict: string): "critical" | "warning" | "success" | "secondary" {
  const v = verdict.toUpperCase();
  if (v.includes("SUCCESS")) return "critical";
  if (v.includes("PARTIAL")) return "warning";
  if (v.includes("BLOCKED")) return "success";
  return "secondary";
}

interface RedTeamTheaterProps {
  turn: TranscriptTurn | null;
  loading?: boolean;
  className?: string;
}

/** Lakera-style split theater — adversarial prompt vs model response. */
export function RedTeamTheater({ turn, loading, className }: RedTeamTheaterProps) {
  if (loading) {
    return <Skeleton className={cn("min-h-[360px] w-full rounded-xl", className)} />;
  }

  if (!turn) {
    return (
      <div
        className={cn(
          "red-team-theater-empty flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 text-center",
          className
        )}
      >
        <p className="text-sm font-medium text-foreground">No active session</p>
        <p className="mt-1 max-w-md text-xs text-muted-foreground">
          Start a scan or select a round to inspect the adversarial exchange between Red Team and
          your target model.
        </p>
      </div>
    );
  }

  const severity =
    turn.severity === "CRITICAL" ||
    turn.severity === "HIGH" ||
    turn.severity === "MEDIUM" ||
    turn.severity === "LOW"
      ? turn.severity
      : "MEDIUM";

  return (
    <div className={cn("red-team-theater overflow-hidden rounded-xl border border-border", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/20 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">Round {turn.roundNumber}</span>
          {turn.asiCode && (
            <Badge variant="outline" className="meta-badge font-mono text-[10px]">
              {turn.asiCode}
            </Badge>
          )}
          <SeverityBadge severity={severity} />
        </div>
        <Badge variant={verdictVariant(turn.verdict)} className="meta-badge font-mono text-[10px] uppercase">
          {turn.verdict}
        </Badge>
      </div>

      <div className="grid min-h-[320px] lg:grid-cols-2">
        <div className="red-team-theater-attack flex flex-col border-b border-border lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5">
            <AgentRoleBadge agentId="redteam" />
            <span className="truncate text-[11px] text-muted-foreground">{turn.attackName}</span>
          </div>
          <div className="flex-1 p-4">
            <p className="section-label mb-2">Adversarial prompt</p>
            <pre className="code-block max-h-[280px] overflow-auto whitespace-pre-wrap break-words text-xs leading-relaxed">
              {turn.attackPrompt}
            </pre>
          </div>
        </div>

        <div className="red-team-theater-target flex flex-col">
          <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5">
            <AgentRoleBadge agentId="target" />
            {turn.blocked && (
              <Badge variant="warning" className="meta-badge">Blocked</Badge>
            )}
          </div>
          <div className="flex-1 p-4">
            <p className="section-label mb-2">Model response</p>
            <pre
              className={cn(
                "code-block max-h-[280px] overflow-auto whitespace-pre-wrap break-words text-xs leading-relaxed",
                turn.blocked && "border-l-2 border-l-status-warning pl-3"
              )}
            >
              {turn.blocked
                ? `[BLOCKED${turn.blockedBy ? ` · ${turn.blockedBy}` : ""}]\n${turn.targetResponse || "—"}`
                : turn.targetResponse || "—"}
            </pre>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-px border-t border-border bg-border">
        {[
          { label: "Attack score", value: turn.attackSuccessScore },
          { label: "Defense", value: turn.defenseQualityScore },
          { label: "Bypass depth", value: turn.bypassDepth },
        ].map((m) => (
          <div key={m.label} className="bg-card px-3 py-2 text-center">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{m.label}</p>
            <p className="font-mono text-lg font-semibold tabular-nums">{m.value}</p>
          </div>
        ))}
      </div>

      {turn.reasoning && (
        <div className="border-t border-border bg-muted/10 px-4 py-3">
          <p className="section-label mb-1.5">Judge reasoning</p>
          <p className="text-xs leading-relaxed text-foreground">{turn.reasoning}</p>
          {turn.asiLabel && (
            <p className="mt-2 text-[10px] text-muted-foreground">
              Category · {turn.asiLabel}
              {turn.asiCode ? ` (${turn.asiCode})` : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
