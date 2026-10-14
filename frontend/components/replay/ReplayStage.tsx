"use client";

import { useState } from "react";
import { Copy, Check, GitCompare, ShieldAlert, ShieldCheck } from "lucide-react";
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
  if (v === "BREACHED" || v === "CRITICAL") return "border-rose-300 bg-rose-50/60 text-rose-900";
  if (v === "SUSPICIOUS" || v === "HIGH") return "border-amber-300 bg-amber-50/60 text-amber-900";
  if (v === "SAFE" || v === "ALLOW" || v === "CONTAINED") return "border-emerald-300 bg-emerald-50/60 text-emerald-900";
  return "border-slate-200 bg-slate-50 text-slate-800";
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
    <div className="flex min-h-[220px] flex-col rounded-xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-3.5 py-2">
        <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-700">
          {title}
        </span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-6 gap-1 px-2 font-mono text-[10px] text-slate-500 hover:text-slate-900 hover:bg-slate-200/60"
          onClick={async () => {
            if (await copyText(text)) {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }
          }}
        >
          {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="flex-1 overflow-auto bg-[#0a0f1d] p-3.5 font-mono text-[11px] leading-relaxed text-slate-200 select-text">
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
  const isBreach = String(verdict).toUpperCase() === "BREACHED" || risk >= 75;

  return (
    <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,340px)_1fr] lg:gap-8 bg-white border-t border-slate-100">
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-slate-600">
              Turn {turn} of {totalTurns}
            </span>
            <span className="font-mono text-[10px] text-slate-500">{formatTs(event.timestamp)}</span>
          </div>
          <h2 className="mt-1.5 font-mono text-lg font-bold tracking-tight text-slate-950 truncate">
            {event.tool_name}
          </h2>
        </div>

        <div
          className={cn(
            "rounded-xl border p-4 text-center shadow-2xs transition-colors",
            verdictTone(String(verdict))
          )}
        >
          <div className="flex items-center justify-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider opacity-80">
            {isBreach ? <ShieldAlert className="h-3.5 w-3.5 text-rose-600" /> : <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />}
            ARTSA decision
          </div>
          <p className="mt-1 font-mono text-xl font-bold uppercase tracking-tight">{verdict}</p>
          <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2">
            <span className="font-mono text-3xl font-bold tabular-nums">{risk.toFixed(0)}</span>
            <SeverityBadge severity={severity} />
          </div>
          <Badge variant="outline" className="mt-2.5 font-mono text-[10px] uppercase font-semibold">
            {action}
          </Badge>
        </div>

        <SessionLayerStrip evaluation={evaluation} />

        {evaluation && (
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 shadow-2xs">
            <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Detector Layers
            </p>
            <ReplayLayerScores evaluation={evaluation} />
          </div>
        )}

        {evaluation?.reasoning && (
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 shadow-2xs">
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Forensic Rationale
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{evaluation.reasoning}</p>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-xs font-bold uppercase tracking-wider text-slate-700">
            Request and recorded result
          </p>
          {showDiff && previousEvent && (
            <Badge variant="secondary" className="gap-1 font-mono text-[10px] text-blue-700 bg-blue-50 border-blue-200">
              <GitCompare className="h-3 w-3" />
              Comparing to Turn {turn - 1}
            </Badge>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <PayloadPanel title="Tool request · arguments" text={formatPayload(event.arguments)} />
          <PayloadPanel title="Recorded response · result" text={formatResponse(event.response)} />
        </div>
        {showDiff && previousEvent && (
          <PayloadPanel title={`Previous Turn ${turn - 1} Request`} text={formatPayload(previousEvent.arguments)} />
        )}
      </div>
    </div>
  );
}
