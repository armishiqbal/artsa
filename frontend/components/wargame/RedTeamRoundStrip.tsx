"use client";

import { cn } from "@/lib/utils";
import type { TranscriptTurn } from "@/lib/campaignTranscript";

function verdictTone(verdict: string): string {
  const v = verdict.toUpperCase();
  if (v.includes("SUCCESS")) return "border-severity-high/40 bg-severity-high/10 text-severity-high";
  if (v.includes("PARTIAL")) return "border-severity-medium/40 bg-severity-medium/10 text-severity-medium";
  if (v.includes("BLOCKED")) return "border-status-success/40 bg-status-success/10 text-status-success";
  return "border-border bg-muted/30 text-muted-foreground";
}

interface RedTeamRoundStripProps {
  turns: TranscriptTurn[];
  selectedRound: number | null;
  onSelectRound: (round: number) => void;
  className?: string;
}

/** Horizontal round navigator — Lakera multi-turn session picker. */
export function RedTeamRoundStrip({
  turns,
  selectedRound,
  onSelectRound,
  className,
}: RedTeamRoundStripProps) {
  if (!turns.length) return null;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)} role="tablist" aria-label="Scan rounds">
      {turns.map((turn) => {
        const selected = selectedRound === turn.roundNumber;
        return (
          <button
            key={turn.roundNumber}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onSelectRound(turn.roundNumber)}
            className={cn(
              "interactive-pill rounded-md border px-2 py-1 font-mono text-[10px] tabular-nums transition-colors",
              verdictTone(turn.verdict),
              selected && "ring-1 ring-inset ring-foreground/20"
            )}
          >
            R{turn.roundNumber}
          </button>
        );
      })}
    </div>
  );
}
