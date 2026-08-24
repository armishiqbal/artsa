"use client";

import { cn } from "@/lib/utils";
import { AgentRoleBadge } from "@/components/pipeline/AgentStatusStrip";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { TranscriptTurn } from "@/lib/campaignTranscript";

function verdictVariant(verdict: string): "critical" | "warning" | "success" | "secondary" {
  const v = verdict.toUpperCase();
  if (v.includes("SUCCESS")) return "critical";
  if (v.includes("PARTIAL")) return "warning";
  if (v.includes("BLOCKED")) return "success";
  return "secondary";
}

interface RedTeamTranscriptProps {
  turns: TranscriptTurn[];
  loading?: boolean;
  selectedRound?: number | null;
  onSelectRound?: (round: number) => void;
  compact?: boolean;
  className?: string;
}

/** Lakera-style multi-turn attack transcript — attacker vs target blocks. */
export function RedTeamTranscript({
  turns,
  loading,
  selectedRound,
  onSelectRound,
  compact,
  className,
}: RedTeamTranscriptProps) {
  if (loading) {
    return <Skeleton className={cn(compact ? "h-48" : "h-72", "w-full rounded-xl", className)} />;
  }

  if (!turns.length) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/10 px-6 text-center",
          compact ? "h-48" : "h-72",
          className
        )}
      >
        <p className="text-sm font-medium text-foreground">No transcript yet</p>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          Configure a target in Evaluation Studio and launch a scan, or pick a completed run from
          history.
        </p>
      </div>
    );
  }

  const active =
    turns.find((t) => t.roundNumber === selectedRound) ?? turns[turns.length - 1];

  if (compact && active) {
    return (
      <div className={cn("space-y-3", className)}>
        <TranscriptTurnView turn={active} />
      </div>
    );
  }

  return (
    <ScrollArea className={cn("h-72 rounded-xl border border-border bg-muted/5", className)}>
      <div className="space-y-3 p-3">
        {turns.map((turn) => {
          const selected = selectedRound === turn.roundNumber;
          return (
            <button
              key={turn.roundNumber}
              type="button"
              onClick={() => onSelectRound?.(turn.roundNumber)}
              className={cn(
                "w-full rounded-lg border border-border bg-card/80 p-3 text-left transition-colors",
                selected && "border-foreground/25 ring-1 ring-inset ring-foreground/10",
                onSelectRound && "hover:border-foreground/20 hover:bg-muted/20"
              )}
            >
              <TurnMeta turn={turn} />
              <div className="mt-2 space-y-2">
                <AttackBlock turn={turn} />
                <TargetBlock turn={turn} />
              </div>
            </button>
          );
        })}
      </div>
    </ScrollArea>
  );
}

function TurnMeta({ turn }: { turn: TranscriptTurn }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-[10px] text-muted-foreground">Round {turn.roundNumber}</span>
      {turn.asiCode && (
        <Badge variant="outline" className="meta-badge font-mono text-[10px]">
          {turn.asiCode}
        </Badge>
      )}
      <Badge variant="secondary" className="meta-badge font-normal">
        {turn.category || "—"}
      </Badge>
      <Badge variant={verdictVariant(turn.verdict)} className="meta-badge font-mono text-[10px] uppercase">
        {turn.verdict}
      </Badge>
    </div>
  );
}

function AttackBlock({ turn }: { turn: TranscriptTurn }) {
  return (
    <div className="rounded-lg border border-border/80 bg-muted/20 p-2">
      <div className="mb-1 flex items-center gap-2">
        <AgentRoleBadge agentId="redteam" />
        <span className="truncate text-[11px] text-muted-foreground">{turn.attackName}</span>
      </div>
      <pre className="code-block max-h-28 overflow-auto whitespace-pre-wrap break-words p-2 text-[11px] leading-relaxed">
        {turn.attackPrompt}
      </pre>
    </div>
  );
}

function TargetBlock({ turn }: { turn: TranscriptTurn }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border/80 bg-card/60 p-2",
        turn.blocked && "border-l-2 border-l-status-warning"
      )}
    >
      <div className="mb-1">
        <AgentRoleBadge agentId="target" />
      </div>
      <pre className="code-block max-h-28 overflow-auto whitespace-pre-wrap break-words p-2 text-[11px] leading-relaxed">
        {turn.blocked
          ? `[BLOCKED${turn.blockedBy ? ` · ${turn.blockedBy}` : ""}]\n${turn.targetResponse || "—"}`
          : turn.targetResponse || "—"}
      </pre>
    </div>
  );
}

function TranscriptTurnView({ turn }: { turn: TranscriptTurn }) {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-3">
      <TurnMeta turn={turn} />
      <div className="mt-3 space-y-2">
        <AttackBlock turn={turn} />
        <TargetBlock turn={turn} />
      </div>
    </div>
  );
}
