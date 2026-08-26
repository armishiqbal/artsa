"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TranscriptTurn } from "@/lib/campaignTranscript";
import { toScore05 } from "@/lib/assessmentResults";
import { isScanFinding } from "@/lib/redTeamScanMetrics";

interface AssessmentResultDetailProps {
  turn: TranscriptTurn | null;
  className?: string;
}

export function AssessmentResultDetail({ turn, className }: AssessmentResultDetailProps) {
  if (!turn) {
    return (
      <div
        className={cn(
          "flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-[#313131] px-4 text-center",
          className
        )}
      >
        <p className="text-[13px] text-[#7c7c7c]">Select a test to inspect the conversation.</p>
      </div>
    );
  }

  const harmful = isScanFinding(turn);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-[#313131] bg-[#0a0a0a]",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#313131] px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-white">{turn.attackName}</p>
          <p className="font-mono text-[10px] text-[#7c7c7c]">
            Round {turn.roundNumber}
            {turn.asiCode ? ` · ${turn.asiCode}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={harmful ? "critical" : "success"} className="meta-badge">
            {harmful ? "Harmful" : "Safe"}
          </Badge>
          <span className="font-mono text-[11px] tabular-nums text-[#a7a7a7]">
            {toScore05(turn.attackSuccessScore)}/5
          </span>
        </div>
      </div>

      <div className="grid border-b border-[#313131] lg:grid-cols-2">
        <div className="border-b border-[#313131] p-4 lg:border-b-0 lg:border-r">
          <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.08em] text-[#7c7c7c]">
            Attack prompt
          </p>
          <pre className="max-h-[220px] overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-[#a7a7a7]">
            {turn.attackPrompt || "—"}
          </pre>
        </div>
        <div className="p-4">
          <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.08em] text-[#7c7c7c]">
            Model response
          </p>
          <pre className="max-h-[220px] overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-[#a7a7a7]">
            {turn.blocked
              ? `[BLOCKED${turn.blockedBy ? ` · ${turn.blockedBy}` : ""}]\n${turn.targetResponse || "—"}`
              : turn.targetResponse || "—"}
          </pre>
        </div>
      </div>

      <div className="px-4 py-3">
        <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.08em] text-[#7c7c7c]">
          Evaluation
        </p>
        <p className="text-[12px] leading-relaxed text-[#a7a7a7]">
          <span className="font-mono text-white">{turn.verdict}</span>
          {turn.reasoning ? ` — ${turn.reasoning}` : " — No judge explanation captured."}
        </p>
      </div>
    </div>
  );
}
