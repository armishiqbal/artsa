"use client";

import { Scale, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { DashboardCard } from "@/components/shared/DashboardCard";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TranscriptTurn } from "@/lib/campaignTranscript";
import { AgentRoleBadge } from "@/components/pipeline/AgentStatusStrip";

function verdictPassed(verdict: string): boolean | null {
  const v = verdict.toUpperCase();
  if (v.includes("SUCCESS")) return false;
  if (v.includes("BLOCKED")) return true;
  if (v.includes("PARTIAL")) return null;
  return null;
}

interface JudgeVerdictPanelProps {
  turn: TranscriptTurn | null;
  className?: string;
}

/** Judge pass/fail panel with reasoning — pairs with Red Team transcript selection. */
export function JudgeVerdictPanel({ turn, className }: JudgeVerdictPanelProps) {
  const passed = turn ? verdictPassed(turn.verdict) : null;

  return (
    <DashboardCard
      title="Judge verdict"
      description="Pass/fail scoring and reasoning for the selected turn"
      icon={<Scale className="h-4 w-4" />}
      className={className}
      badge={
        turn ? (
          <Badge variant="outline" className="meta-badge gap-1">
            {passed === true ? (
              <CheckCircle2 className="h-3 w-3 text-status-success" aria-hidden />
            ) : passed === false ? (
              <XCircle className="h-3 w-3 text-destructive" aria-hidden />
            ) : (
              <AlertTriangle className="h-3 w-3 text-status-warning" aria-hidden />
            )}
            {turn.verdict}
          </Badge>
        ) : null
      }
    >
      {!turn ? (
        <p className="text-sm text-muted-foreground">
          Select a transcript round to inspect judge scoring and bypass depth.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <AgentRoleBadge agentId="judge" />
            <SeverityBadge
              severity={
                turn.severity === "CRITICAL" ||
                turn.severity === "HIGH" ||
                turn.severity === "MEDIUM" ||
                turn.severity === "LOW"
                  ? turn.severity
                  : "MEDIUM"
              }
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Attack score", value: turn.attackSuccessScore },
              { label: "Defense quality", value: turn.defenseQualityScore },
              { label: "Bypass depth", value: turn.bypassDepth },
            ].map((m) => (
              <div
                key={m.label}
                className="rounded-lg border border-border bg-muted/20 px-2 py-2 text-center"
              >
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{m.label}</p>
                <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{m.value}</p>
              </div>
            ))}
          </div>

          <div>
            <p className="section-label mb-1.5">Reasoning</p>
            <p
              className={cn(
                "rounded-lg border border-border bg-muted/10 p-3 text-sm leading-relaxed text-foreground",
                !turn.reasoning && "text-muted-foreground"
              )}
            >
              {turn.reasoning || "No LLM judge reasoning captured for this turn."}
            </p>
          </div>

          {turn.asiLabel && (
            <p className="text-xs text-muted-foreground">
              Mapped category · <span className="text-foreground">{turn.asiLabel}</span>
              {turn.asiCode ? ` (${turn.asiCode})` : null}
            </p>
          )}
        </div>
      )}
    </DashboardCard>
  );
}
