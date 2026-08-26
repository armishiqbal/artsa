"use client";

import { AlertTriangle } from "lucide-react";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { TranscriptTurn } from "@/lib/campaignTranscript";

function severityOrder(turn: TranscriptTurn): number {
  const s = turn.severity.toUpperCase();
  if (s === "CRITICAL") return 4;
  if (s === "HIGH") return 3;
  if (s === "MEDIUM") return 2;
  if (s === "LOW") return 1;
  return 0;
}

function isFinding(turn: TranscriptTurn): boolean {
  const v = turn.verdict.toUpperCase();
  return v.includes("SUCCESS") || v.includes("PARTIAL") || turn.attackSuccessScore >= 5;
}

interface RedTeamFindingsPanelProps {
  turns: TranscriptTurn[];
  selectedRound: number | null;
  onSelectRound: (round: number) => void;
  className?: string;
}

/** findings rail — ranked security issues from the scan. */
export function RedTeamFindingsPanel({
  turns,
  selectedRound,
  onSelectRound,
  className,
}: RedTeamFindingsPanelProps) {
  const findings = turns
    .filter(isFinding)
    .sort((a, b) => severityOrder(b) - severityOrder(a) || b.attackSuccessScore - a.attackSuccessScore);

  return (
    <div className={cn("flex flex-col overflow-hidden", className)}>
      <div className="dashboard-card-header border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <p className="text-sm font-semibold tracking-tight">Findings</p>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {findings.length} issue{findings.length === 1 ? "" : "s"} surfaced
        </p>
      </div>
      <ScrollArea className="max-h-[280px]">
        {findings.length === 0 ? (
          <p className="p-4 text-xs text-muted-foreground">
            No successful attacks yet — defenses held or scan not complete.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {findings.map((turn) => {
              const selected = selectedRound === turn.roundNumber;
              const severity =
                turn.severity === "CRITICAL" ||
                turn.severity === "HIGH" ||
                turn.severity === "MEDIUM" ||
                turn.severity === "LOW"
                  ? turn.severity
                  : "MEDIUM";
              return (
                <li key={turn.roundNumber}>
                  <button
                    type="button"
                    onClick={() => onSelectRound(turn.roundNumber)}
                    className={cn(
                      "interactive-row flex w-full flex-col gap-1.5 border-l-2 px-4 py-3 text-left",
                      selected ? "border-l-foreground bg-muted/60" : "border-l-transparent"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <SeverityBadge severity={severity} />
                      <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                        R{turn.roundNumber}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-xs text-foreground">{turn.attackPrompt}</p>
                    <div className="flex flex-wrap gap-1">
                      {turn.asiCode && (
                        <Badge variant="outline" className="meta-badge font-mono text-[9px]">
                          {turn.asiCode}
                        </Badge>
                      )}
                      <Badge variant="secondary" className="meta-badge text-[9px] font-normal uppercase">
                        {turn.verdict}
                      </Badge>
                    </div>
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
