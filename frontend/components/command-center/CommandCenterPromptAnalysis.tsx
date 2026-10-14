"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  highlightPrompt,
  type AsiBar,
  type LiveRound,
  type PromptSpan,
} from "./prototype/liveRounds";

export function CommandCenterPromptAnalysis({
  round,
  liveMode,
  sessionId,
  className,
  onSelectThreat,
  onSelectHighlight,
  onSelectBadge,
  onQuarantineTarget,
  onDeployMitigation,
}: {
  round: LiveRound;
  liveMode: boolean;
  sessionId: string | null;
  className?: string;
  onSelectThreat?: (bar: AsiBar) => void;
  onSelectHighlight?: (span: PromptSpan) => void;
  onSelectBadge?: () => void;
  onQuarantineTarget?: (target: string) => void;
  onDeployMitigation?: (content: string) => void;
}) {
  const spans = useMemo(
    () => round.prompt ? highlightPrompt(round.prompt, round.highlights) : [],
    [round.prompt, round.highlights]
  );

  const isFailed =
    round.badgeTone === "error" ||
    Boolean(round.statusBadge?.includes("FAIL")) ||
    round.bars.some((b) => b.code === "HMAC" || b.label.includes("fail"));

  const badgeText =
    round.statusBadge ?? `round ${round.round} · ${isFailed ? "VERIFICATION FAILED" : "status unavailable"}`;
  const eventSessionId = round.event?.sessionId;

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border bg-white p-5 shadow-2xs transition-colors",
        isFailed
          ? "border-rose-300/90 bg-rose-50/30"
          : "border-slate-200/80 bg-white",
        className
      )}
    >
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            {liveMode ? "RECORDED EVENT CONTENT" : "WALKTHROUGH SAMPLE CONTENT"} · {round.from} → {round.to}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {liveMode && sessionId && onDeployMitigation && round.prompt.trim() ? (
            <button
              type="button"
              onClick={() => onDeployMitigation(round.prompt)}
              className="rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider border border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors cursor-pointer"
              title="Deploy authoritative policy mitigation rule from this prompt"
            >
              REQUEST MITIGATION
            </button>
          ) : null}
          {liveMode && onQuarantineTarget && eventSessionId && eventSessionId !== "—" ? (
            <button
              type="button"
              onClick={() => onQuarantineTarget(eventSessionId)}
              className={cn(
                "rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider border transition-colors cursor-pointer",
                isFailed || round.bars.some((bar) => bar.tone === "alert")
                  ? "border-rose-500/60 bg-rose-500/15 text-rose-600 dark:text-rose-400 hover:bg-rose-500/25 animate-pulse"
                  : "border-rose-500/40 bg-rose-500/5 text-rose-600 dark:text-rose-400 hover:bg-rose-500/15"
              )}
              title="Request quarantine for the recorded session"
            >
              QUARANTINE SESSION
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onSelectBadge?.()}
            className={cn(
              "rounded-full px-3 py-0.5 font-mono text-[11px] font-medium tracking-wide uppercase transition-colors cursor-pointer hover:opacity-90",
              isFailed
                ? "border border-red-300 bg-red-100 text-red-700 dark:border-red-800/60 dark:bg-red-950/80 dark:text-red-400"
                : "border border-red-200 bg-red-50 text-red-600 dark:border-red-800/50 dark:bg-red-950/60 dark:text-red-400"
            )}
            title="Click to inspect verification telemetry"
          >
            {badgeText}
          </button>
        </div>
      </div>

      {/* Code Box */}
      <div className="rounded-xl border border-slate-800 bg-[#0a0f1d] p-4 text-[13px] leading-relaxed text-slate-100 shadow-inner">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-3 font-mono text-[10px] text-slate-400">
          <span className="flex items-center gap-1.5 uppercase font-semibold tracking-wider text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            {liveMode ? "Backend event text" : "Walkthrough sample text"}
          </span>
          <span className="text-slate-500 font-mono">{round.event?.eventId ?? "No event ID"}</span>
        </div>
        <p className="font-mono break-words whitespace-pre-wrap">
          {round.prompt.trim() ? spans.map((s, i) => {
            if (s.tone === "inject") {
              return (
                <mark
                  key={i}
                  onClick={() => onSelectHighlight?.(s)}
                  className="rounded border border-rose-500/60 bg-rose-500/25 text-rose-200 px-1.5 py-0.5 font-mono inline-block my-0.5 font-semibold cursor-pointer hover:border-rose-400 hover:bg-rose-500/35 transition-colors shadow-2xs"
                  title="Click to inspect injection token"
                >
                  {s.text}
                </mark>
              );
            }
            if (s.tone === "tool") {
              return (
                <mark
                  key={i}
                  onClick={() => onSelectHighlight?.(s)}
                  className="rounded border border-amber-500/60 bg-amber-500/25 text-amber-200 px-1.5 py-0.5 font-mono inline-block my-0.5 font-semibold cursor-pointer hover:border-amber-400 hover:bg-amber-500/35 transition-colors shadow-2xs"
                  title="Click to inspect tool token"
                >
                  {s.text}
                </mark>
              );
            }
            return <span key={i} className="text-slate-300">{s.text}</span>;
          }) : <span className="text-slate-400">No event text was included in the backend record.</span>}
        </p>
      </div>

      {/* Threat / Verification Gauge Bars */}
      <div className="mt-4 space-y-2.5">
        {round.bars.map((bar) => {
          const isAlert =
            bar.tone === "alert" ||
            bar.code === "HMAC" ||
            bar.label.includes("fail") ||
            bar.label.includes("hijack");
          return (
            <button
              key={`${bar.code}-${bar.label}`}
              type="button"
              aria-label={`Inspect ${bar.code} ${bar.label}`}
              onClick={() => onSelectThreat?.(bar)}
              className="grid w-full grid-cols-[120px_1fr_48px] items-center gap-3 font-mono text-[11px] text-left hover:opacity-90 transition-opacity cursor-pointer group"
              title={`Click to inspect ${bar.code} ${bar.label} (${bar.pct}%)`}
            >
              <span className="uppercase text-muted-foreground tracking-wide group-hover:text-foreground transition-colors">
                {bar.code} {bar.label}
              </span>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800/80">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    isAlert
                      ? "bg-gradient-to-r from-red-600 to-rose-400"
                      : "bg-gradient-to-r from-amber-600 to-amber-400"
                  )}
                  style={{ width: `${Math.min(100, Math.max(0, bar.pct))}%` }}
                />
              </div>
              <span
                className={cn(
                  "text-right tabular-nums font-semibold",
                  isAlert ? "text-red-400" : "text-amber-400"
                )}
              >
                {bar.pct}%
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
