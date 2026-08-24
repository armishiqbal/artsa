"use client";

import { useState } from "react";
import { Copy, Check, GitCompare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import { SessionLayerStrip } from "@/components/shared/SessionLayerStrip";
import { ReplayLayerScores } from "@/components/replay/ReplayLayerScores";
import { formatPayload, formatResponse } from "@/lib/replayFormat";
import { severityFromScore } from "@/lib/severity";
import { categorizeTrajectoryAction } from "@/lib/replayTrajectory";
import type { ToolCallEvent } from "@/lib/types";
import type { EvaluationView } from "@/components/replay/ReplayEventInspector";
import { cn } from "@/lib/utils";

function formatTs(ts: string): string {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

function verdictTone(verdict: string): string {
  const v = verdict.toUpperCase();
  if (v === "BREACHED" || v === "CRITICAL") return "border-destructive/50 bg-destructive/10 text-destructive";
  if (v === "SUSPICIOUS" || v === "HIGH") return "border-status-warning/50 bg-status-warning/10 text-status-warning";
  if (v === "SAFE" || v === "ALLOW") return "border-status-success/50 bg-status-success/10 text-status-success";
  return "border-border bg-muted/30";
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function PayloadPanel({ title, text }: { title: string; text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex min-h-[200px] flex-col rounded-xl border border-border bg-[hsl(var(--foreground)/0.02)]">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-medium">{title}</span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 gap-1 text-[10px]"
          onClick={async () => {
            if (await copyText(text)) {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }
          }}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          Copy
        </Button>
      </div>
      <pre className="flex-1 overflow-auto p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
        {text}
      </pre>
    </div>
  );
}

export function ReplayStage({
  event,
  evaluation,
  previousEvent,
  showDiff,
  turn,
  totalTurns,
}: {
  event: ToolCallEvent;
  evaluation?: EvaluationView | null;
  previousEvent?: ToolCallEvent | null;
  showDiff: boolean;
  turn: number;
  totalTurns: number;
}) {
  const risk =
    typeof evaluation?.risk_score === "number" && Number.isFinite(evaluation.risk_score)
      ? evaluation.risk_score
      : 0;
  const severity = severityFromScore(risk);
  const verdict = evaluation?.verdict ?? "—";
  const action = categorizeTrajectoryAction(event.tool_name, evaluation?.verdict);

  return (
    <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,340px)_1fr] lg:gap-8">
      <div className="space-y-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Turn {turn} of {totalTurns}
          </p>
          <h2 className="mt-1 font-mono text-xl font-semibold">{event.tool_name}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{formatTs(event.timestamp)}</p>
        </div>

        <div
          className={cn(
            "rounded-2xl border px-4 py-5 text-center",
            verdictTone(String(verdict))
          )}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">Guard verdict</p>
          <p className="mt-1 text-2xl font-bold">{verdict}</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <span className="font-mono text-3xl font-bold tabular-nums">{risk.toFixed(0)}</span>
            <SeverityBadge severity={severity} />
          </div>
          <Badge variant="outline" className="mt-3 text-[10px]">
            {action}
          </Badge>
        </div>

        <SessionLayerStrip evaluation={evaluation} />

        {evaluation && (
          <div className="rounded-xl border border-border bg-muted/15 p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Detector layers
            </p>
            <ReplayLayerScores evaluation={evaluation} />
          </div>
        )}

        {evaluation?.reasoning && (
          <div className="rounded-xl border border-border bg-muted/10 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Why it mattered
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{evaluation.reasoning}</p>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">Tool exchange</p>
          {showDiff && previousEvent && (
            <Badge variant="secondary" className="gap-1 text-[10px]">
              <GitCompare className="h-3 w-3" />
              Comparing to previous turn
            </Badge>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <PayloadPanel title="Request" text={formatPayload(event.arguments)} />
          <PayloadPanel title="Response" text={formatResponse(event.response)} />
        </div>
        {showDiff && previousEvent && (
          <PayloadPanel title="Previous request" text={formatPayload(previousEvent.arguments)} />
        )}
      </div>
    </div>
  );
}
