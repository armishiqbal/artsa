"use client";

import { cn } from "@/lib/utils";
import type { AsiCategory } from "@/lib/asiCategories";
import type { TranscriptTurn } from "@/lib/campaignTranscript";

interface CoverageCell {
  code: string;
  short: string;
  tested: boolean;
  breached: boolean;
  rounds: number;
}

function buildCoverage(expected: AsiCategory[], turns: TranscriptTurn[]): CoverageCell[] {
  return expected.map((asi) => {
    const matching = turns.filter((t) => t.asiCode === asi.code);
    const breached = matching.some((t) => t.verdict.toUpperCase().includes("SUCCESS"));
    return {
      code: asi.code,
      short: asi.short,
      tested: matching.length > 0,
      breached,
      rounds: matching.length,
    };
  });
}

interface RedTeamCoverageGridProps {
  objectives: AsiCategory[];
  turns: TranscriptTurn[];
  className?: string;
}

/** OWASP Agentic coverage matrix — tested vs breached per objective. */
export function RedTeamCoverageGrid({ objectives, turns, className }: RedTeamCoverageGridProps) {
  const cells = buildCoverage(objectives, turns);
  if (!objectives.length) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <p className="section-label">Objective coverage</p>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {cells.map((cell) => (
          <div
            key={cell.code}
            className={cn(
              "rounded-md border px-2 py-2 text-center transition-colors",
              !cell.tested && "border-border/60 bg-muted/10",
              cell.tested && !cell.breached && "border-status-success/30 bg-status-success/5",
              cell.breached && "border-severity-high/40 bg-severity-high/10"
            )}
          >
            <p className="font-mono text-[10px] font-medium">{cell.code}</p>
            <p className="mt-0.5 text-[9px] text-muted-foreground truncate">{cell.short}</p>
            <p className="mt-1 font-mono text-[9px] tabular-nums text-muted-foreground">
              {cell.tested ? (cell.breached ? "Breached" : "Held") : "—"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
