"use client";

import { AlertOctagon, Ban, RotateCcw, Shield, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OperatorActionType } from "./CommandCenterConfirmationModal";

export function CommandCenterOperatorToolbar({
  onRequestAction,
  onReplayCurrentRound,
  liveMode,
  sessionId,
  toolName,
  campaignId,
  roundNumber,
  lastOperatorAction,
  className,
}: {
  onRequestAction: (actionType: OperatorActionType, targetName?: string) => void;
  onReplayCurrentRound?: () => void;
  liveMode: boolean;
  sessionId: string | null;
  toolName: string | null;
  campaignId: string | null;
  roundNumber: number | null;
  lastOperatorAction?: string | null;
  className?: string;
}) {
  return (
    <div
      aria-label="Operator Containment and Simulation Controls"
      className={cn(
        "flex flex-col gap-2 rounded-xl border border-border bg-card/60 p-3.5 font-mono text-[11px] transition-colors",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-sans text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            OPERATOR INTERVENTION DECK
          </span>
        </div>

        <span className="text-[10px] text-muted-foreground">
          Requests are sent to the backend after confirmation.
        </span>
      </div>

      {/* Control Buttons Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 pt-1 font-mono text-[10px]">
        {/* Kill Session */}
        <button
          type="button"
          disabled={!liveMode || !sessionId}
          onClick={() => onRequestAction("KILL_SESSION", sessionId ?? undefined)}
          className="flex items-center justify-center gap-1.5 rounded border border-rose-500/40 bg-rose-500/10 px-2.5 py-2 font-semibold text-rose-500 hover:bg-rose-500/20 active:scale-[0.98] transition-colors enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          title={liveMode && sessionId ? `Request termination for session ${sessionId}` : "No live session is available"}
        >
          <AlertOctagon className="h-3.5 w-3.5" />
          KILL SESSION
        </button>

        {/* Quarantine Agent */}
        <button
          type="button"
          disabled={!liveMode || !sessionId}
          onClick={() => onRequestAction("QUARANTINE_AGENT", sessionId ?? undefined)}
          className="flex items-center justify-center gap-1.5 rounded border border-rose-500/30 bg-rose-500/5 px-2.5 py-2 font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/15 active:scale-[0.98] transition-colors enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          title={liveMode && sessionId ? `Request quarantine for session ${sessionId}` : "No live session is available"}
        >
          <Shield className="h-3.5 w-3.5" />
          QUARANTINE SESSION
        </button>

        {/* Block Tool */}
        <button
          type="button"
          disabled={!liveMode || !sessionId || !toolName}
          onClick={() => onRequestAction("BLOCK_TOOL", toolName ?? undefined)}
          className="flex items-center justify-center gap-1.5 rounded border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 font-semibold text-amber-500 hover:bg-amber-500/20 active:scale-[0.98] transition-colors enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          title={liveMode && sessionId && toolName ? `Request blocking ${toolName} for session ${sessionId}` : "A live session and recorded tool name are required"}
        >
          <Ban className="h-3.5 w-3.5" />
          BLOCK TOOL
        </button>

        {/* Replay Round */}
        <button
          type="button"
          disabled={!liveMode || !campaignId || !roundNumber || !onReplayCurrentRound}
          onClick={() => onReplayCurrentRound?.()}
          className="flex items-center justify-center gap-1.5 rounded border border-border bg-card px-2.5 py-2 font-semibold text-foreground hover:bg-muted active:scale-[0.98] transition-colors enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          title={campaignId && roundNumber ? `Replay saved round ${roundNumber} for campaign ${campaignId}` : "A saved campaign round is required"}
        >
          <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
          REPLAY SAVED ROUND
        </button>

        {/* Deploy Mitigation */}
        <button
          type="button"
          disabled={!liveMode || !sessionId}
          onClick={() => onRequestAction("DEPLOY_MITIGATION", sessionId ?? undefined)}
          className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 rounded border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-2 font-semibold text-emerald-500 hover:bg-emerald-500/20 active:scale-[0.98] transition-colors enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          title={liveMode && sessionId ? `Request mitigation for session ${sessionId}` : "No live session is available"}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          REQUEST MITIGATION
        </button>
      </div>

      {/* Audit Feedback Banner if action performed */}
      {lastOperatorAction ? (
        <div className="mt-1 flex items-center justify-between rounded border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-[10px] text-sky-400">
          <span>
            ACTION RESULT: <span className="font-semibold text-foreground">{lastOperatorAction}</span>
          </span>
          <span className="text-[9px] uppercase font-mono text-muted-foreground">
            RESPONSE STATUS
          </span>
        </div>
      ) : null}
    </div>
  );
}
