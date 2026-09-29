"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  highlightPrompt,
  type AsiBar,
  type LiveRound,
  type PromptSpan,
} from "./prototype/liveRounds";
import { CrescendoTrajectoryStepper } from "./CrescendoTrajectoryStepper";

export function CommandCenterPromptAnalysis({
  round,
  className,
  onSelectThreat,
  onSelectHighlight,
  onSelectBadge,
  onQuarantineTarget,
  onDeployMitigation,
}: {
  round: LiveRound;
  className?: string;
  onSelectThreat?: (bar: AsiBar) => void;
  onSelectHighlight?: (span: PromptSpan) => void;
  onSelectBadge?: () => void;
  onQuarantineTarget?: (target: string) => void;
  onDeployMitigation?: (content: string) => void;
}) {
  const [showCrescendoStepper, setShowCrescendoStepper] = useState(false);
  const spans = useMemo(
    () => highlightPrompt(round.prompt, round.highlights),
    [round.prompt, round.highlights]
  );

  const isFailed =
    round.badgeTone === "error" ||
    Boolean(round.statusBadge?.includes("FAIL")) ||
    round.bars.some((b) => b.code === "HMAC" || b.label.includes("fail"));

  const badgeText =
    round.statusBadge ?? `round ${round.round} · ${isFailed ? "VERIFICATION FAILED" : "live"}`;

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border p-5 shadow-lg transition-colors",
        isFailed
          ? "border-red-300/80 bg-red-50/40 dark:border-red-900/40 dark:bg-[#090b10]"
          : "border-border bg-card dark:border-red-950/40 dark:bg-[#090b10]",
        className
      )}
    >
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            LIVE PROMPT ANALYSIS · {round.from} → {round.to}
          </span>
          <button
            type="button"
            onClick={() => setShowCrescendoStepper((prev) => !prev)}
            className={cn(
              "rounded px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider border transition-colors cursor-pointer",
              showCrescendoStepper
                ? "border-rose-500/80 bg-rose-500/20 text-rose-300"
                : "border-border/60 bg-muted/40 text-muted-foreground hover:text-foreground"
            )}
            title="Toggle Crescendo multi-turn steering trajectory stepper"
          >
            {showCrescendoStepper ? "Hide Crescendo Stepper" : "Crescendo Stepper"}
          </button>
        </div>
        <div className="flex items-center gap-2">
          {onDeployMitigation ? (
            <button
              type="button"
              onClick={() => onDeployMitigation(round.prompt)}
              className="rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider border border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors cursor-pointer"
              title="Deploy authoritative policy mitigation rule from this prompt"
            >
              DEPLOY MITIGATION
            </button>
          ) : null}
          {onQuarantineTarget ? (
            <button
              type="button"
              onClick={() => onQuarantineTarget(round.to)}
              className={cn(
                "rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider border transition-colors cursor-pointer",
                isFailed || round.bars.some((b) => b.pct >= 70)
                  ? "border-rose-500/60 bg-rose-500/15 text-rose-600 dark:text-rose-400 hover:bg-rose-500/25 animate-pulse"
                  : "border-rose-500/40 bg-rose-500/5 text-rose-600 dark:text-rose-400 hover:bg-rose-500/15"
              )}
              title={`Quick quarantine ${round.to}`}
            >
              QUARANTINE TARGET
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

      {showCrescendoStepper && (
        <div className="mb-4">
          <CrescendoTrajectoryStepper
            onDeployMitigation={(turn) => onDeployMitigation?.(turn.prompt)}
          />
        </div>
      )}

      {/* Code Box */}
      <div className="rounded-lg border border-border bg-muted/40 p-4 text-[13px] leading-relaxed text-foreground dark:border-white/[0.06] dark:bg-[#05070a] dark:text-slate-200">
        <p className="font-mono break-words whitespace-pre-wrap">
          {spans.map((s, i) => {
            if (s.tone === "inject") {
              return (
                <mark
                  key={i}
                  onClick={() => onSelectHighlight?.(s)}
                  className="rounded border border-red-800/50 bg-red-950/80 px-1.5 py-0.5 font-mono text-red-300 inline-block my-0.5 font-medium cursor-pointer hover:border-red-600 transition-colors"
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
                  className="rounded border border-amber-700/50 bg-amber-950/70 px-1.5 py-0.5 font-mono text-amber-300 inline-block my-0.5 font-medium cursor-pointer hover:border-amber-600 transition-colors"
                  title="Click to inspect tool token"
                >
                  {s.text}
                </mark>
              );
            }
            return <span key={i}>{s.text}</span>;
          })}
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
