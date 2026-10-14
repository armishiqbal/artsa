"use client";

import { useState } from "react";
import { Check, Copy, GitCompare, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ToolCallEvent } from "@/lib/types";
import type { EvaluationView } from "@/components/replay/ReplayEventInspector";

function serialize(value: unknown): string {
  if (value == null) return "No backend record.";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function ForensicEvidenceWorkbench({
  event,
  evaluation,
  previousEvent,
  showDiff,
  onToggleDiff,
  hopIndex,
  totalHops,
}: {
  event: ToolCallEvent;
  evaluation?: EvaluationView | null;
  previousEvent?: ToolCallEvent | null;
  showDiff: boolean;
  onToggleDiff: () => void;
  hopIndex: number;
  totalHops: number;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const risk =
    typeof evaluation?.risk_score === "number" && Number.isFinite(evaluation.risk_score)
      ? evaluation.risk_score
      : null;
  const verdict = typeof evaluation?.verdict === "string" ? evaluation.verdict : "UNCLASSIFIED";
  const rationale = typeof evaluation?.reasoning === "string" ? evaluation.reasoning : null;
  const confidence =
    typeof evaluation?.confidence === "number" && Number.isFinite(evaluation.confidence)
      ? evaluation.confidence
      : null;

  const copy = async (key: string, value: unknown) => {
    try {
      await navigator.clipboard.writeText(serialize(value));
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied(null);
    }
  };

  const EvidenceBlock = ({ label, value, copyKey }: { label: string; value: unknown; copyKey: string }) => (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2">
        <h3 className="font-mono text-xs font-semibold uppercase tracking-wide text-slate-700">{label}</h3>
        <Button type="button" size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" onClick={() => void copy(copyKey, value)}>
          {copied === copyKey ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied === copyKey ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-100">
        {serialize(value)}
      </pre>
    </section>
  );

  return (
    <section className="space-y-4" aria-label="Backend forensic evidence">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wide text-slate-500">
            Recorded event {hopIndex + 1} of {totalHops}
          </p>
          <h2 className="mt-1 flex items-center gap-2 font-mono text-lg font-bold text-slate-950">
            {event.tool_name}
            {verdict === "BREACHED" && <ShieldAlert className="h-4 w-4 text-rose-600" aria-label="Backend verdict: breached" />}
          </h2>
          <p className="mt-1 font-mono text-xs text-slate-500">
            Event ID: {event.id || "—"} · Trace: {event.trace_id || "—"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded border border-slate-200 px-2 py-1 font-mono text-xs text-slate-700">
            Verdict: {verdict}
          </span>
          <span className="rounded border border-slate-200 px-2 py-1 font-mono text-xs text-slate-700">
            Risk: {risk == null ? "—" : String(risk) + "/100"}
          </span>
          {confidence != null && (
            <span className="rounded border border-slate-200 px-2 py-1 font-mono text-xs text-slate-700">
              Confidence: {confidence}
            </span>
          )}
        </div>
      </header>

      {rationale && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="font-mono text-xs font-semibold uppercase tracking-wide text-slate-700">Recorded rationale</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">{rationale}</p>
        </div>
      )}

      {previousEvent && (
        <div className="flex justify-end">
          <Button type="button" size="sm" variant="outline" className="gap-2" onClick={onToggleDiff}>
            <GitCompare className="h-3.5 w-3.5" />
            {showDiff ? "Hide previous event" : "Compare previous event"}
          </Button>
        </div>
      )}

      {showDiff && previousEvent ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <EvidenceBlock label="Previous event arguments" value={previousEvent.arguments} copyKey="previous" />
          <EvidenceBlock label="Current event arguments" value={event.arguments} copyKey="current" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <EvidenceBlock label="Recorded tool arguments" value={event.arguments} copyKey="arguments" />
          <EvidenceBlock label="Recorded response" value={event.response} copyKey="response" />
        </div>
      )}

      <EvidenceBlock label="Backend evaluation record" value={evaluation ?? null} copyKey="evaluation" />
    </section>
  );
}
