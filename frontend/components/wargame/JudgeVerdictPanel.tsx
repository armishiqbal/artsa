"use client";

import { Scale, CheckCircle2, XCircle, AlertTriangle, Ban } from "lucide-react";
import { DashboardCard } from "@/components/shared/DashboardCard";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TranscriptTurn } from "@/lib/campaignTranscript";
import { AgentRoleBadge } from "@/components/pipeline/AgentStatusStrip";

/** true = defense win, false = attack win, null = partial/error/unknown */
function verdictPassed(verdict: string): boolean | null {
  const v = verdict.toUpperCase();
  if (v.includes("ERROR")) return null;
  if (v.includes("SUCCESS")) return false;
  if (v.includes("BLOCKED")) return true;
  if (v.includes("PARTIAL")) return null;
  return null;
}

function isInfraError(turn: TranscriptTurn): boolean {
  return turn.targetError || turn.verdict.toUpperCase().includes("ERROR");
}

interface JudgeVerdictPanelProps {
  turn: TranscriptTurn | null;
  className?: string;
}

/** Judge pass/fail panel with reasoning — pairs with Red Team transcript selection. */
export function JudgeVerdictPanel({ turn, className }: JudgeVerdictPanelProps) {
  const infra = turn ? isInfraError(turn) : false;
  const passed = turn && !infra ? verdictPassed(turn.verdict) : null;

  return (
    <DashboardCard
      title="Judge verdict"
      description="Pass/fail scoring and reasoning for the selected turn"
      icon={<Scale className="h-4 w-4" />}
      className={className}
      badge={
        turn ? (
          <Badge variant="outline" className="meta-badge gap-1">
            {infra ? (
              <Ban className="h-3 w-3 text-status-warning" aria-hidden />
            ) : passed === true ? (
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
          {infra ? (
            <p className="rounded-lg border border-status-warning/40 bg-status-warning/10 px-3 py-2 text-sm text-foreground">
              Target did not answer (API/billing/network). This is not a security block — re-run
              with a funded key or local model for a real score.
              {turn.errorDetail ? (
                <span className="mt-1 block font-mono text-[11px] text-muted-foreground">
                  {turn.errorDetail}
                </span>
              ) : null}
            </p>
          ) : null}

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

          {(turn.objective || turn.templateId || turn.mutationsApplied.length > 0) && (
            <div className="space-y-1.5 rounded-lg border border-border bg-muted/10 p-3 text-xs">
              <p className="section-label">Attack selection</p>
              {turn.objective ? (
                <p>
                  <span className="text-muted-foreground">Objective · </span>
                  {turn.objective}
                </p>
              ) : null}
              {turn.templateId ? (
                <p className="font-mono">
                  <span className="font-sans text-muted-foreground">Template · </span>
                  {turn.templateId}
                </p>
              ) : null}
              {turn.mutationsApplied.length > 0 ? (
                <p>
                  <span className="text-muted-foreground">Mutations · </span>
                  {turn.mutationsApplied.join(", ")}
                </p>
              ) : null}
            </div>
          )}

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
