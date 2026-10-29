"use client";

import Link from "next/link";
import {
  Download,
  Microscope,
  Pause,
  Play,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Session } from "@/lib/types";
import { severityFromScore } from "@/lib/severity";
import { cn } from "@/lib/utils";

function statusTone(status: Session["status"]): string {
  if (status === "BREACHED") return "border-rose-300 bg-rose-50 text-rose-700 font-semibold";
  if (status === "QUARANTINED") return "border-amber-300 bg-amber-50 text-amber-700 font-semibold";
  if (status === "ACTIVE") return "border-emerald-300 bg-emerald-50 text-emerald-700 font-semibold";
  return "border-slate-200 bg-slate-50 text-slate-600 font-medium";
}

export function ReplayTheaterHeader({
  selectedSession,
  selectedSessionId,
  sessionSource,
  timelineSource,
  loadingSessions,
  sessionActionsDisabled,
  peakRisk,
  breachedCount,
  eventCount,
  playing,
  onTogglePlay,
  onPrev,
  onNext,
  canPrev,
  canNext,
  onExport,
  onForensics,
  forensicsLoading,
  exportDisabled,
  actionLoading,
  onQuarantine,
  onKill,
}: {
  selectedSession: Session | undefined;
  selectedSessionId: string | null;
  sessionSource: "live" | "walkthrough";
  timelineSource: "live" | "walkthrough";
  loadingSessions: boolean;
  sessionActionsDisabled: boolean;
  peakRisk: number;
  breachedCount: number;
  eventCount: number;
  playing: boolean;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
  onExport: () => void;
  onForensics: () => void;
  forensicsLoading: boolean;
  exportDisabled: boolean;
  actionLoading: boolean;
  onQuarantine: () => void;
  onKill: () => void;
}) {
  const peakSeverity = severityFromScore(peakRisk);
  const isBreached = selectedSession?.status === "BREACHED" || peakRisk >= 75;

  return (
    <header className="rounded-xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden transition-colors">
      {/* Top Telemetry Status Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2 w-2">
            <span
              className={cn(
                "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                isBreached ? "bg-rose-400" : "bg-emerald-400"
              )}
            />
            <span
              className={cn(
                "relative inline-flex h-2 w-2 rounded-full",
                isBreached ? "bg-rose-600" : "bg-emerald-600"
              )}
            />
          </span>
          <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-600">
            ARTSA AI THREAT FORENSICS <span className="text-slate-300">/</span> SESSION FORENSICS
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              "font-mono text-[10px] uppercase shadow-2xs",
              timelineSource === "live"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            )}
          >
            {timelineSource === "live" ? "API Trace" : "Walkthrough Trace"}
          </Badge>

          <Badge
            variant="outline"
            className={cn(
              "font-mono text-[10px] uppercase shadow-2xs",
              sessionSource === "live"
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : "border-slate-200 bg-white text-slate-600"
            )}
          >
            {loadingSessions ? "Loading sessions…" : sessionSource === "live" ? "API Fleet" : "Sample Sessions"}
          </Badge>

          {selectedSession && (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase shadow-2xs",
                statusTone(selectedSession.status)
              )}
            >
              {isBreached ? <ShieldAlert className="h-3 w-3 text-rose-600" /> : <ShieldCheck className="h-3 w-3 text-emerald-600" />}
              {selectedSession.status}
            </span>
          )}

          {selectedSession?.circuit_breaker_open && (
            <span className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase text-rose-700 shadow-2xs">
              Circuit Breaker Tripped
            </span>
          )}
        </div>
      </div>

      {/* Main Forensic Header Deck */}
      <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0 space-y-1">
          <p className="font-mono text-[10.5px] uppercase tracking-wider text-slate-500">
            {selectedSession
              ? `Session ${selectedSession.id}`
              : selectedSessionId
              ? `Requested session ${selectedSessionId}`
              : "No session selected"}
          </p>
          <h1 className="truncate text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">
            {selectedSession?.agent_id ?? "Forensic Session Replay"}
          </h1>
          <p className="max-w-2xl text-xs leading-5 text-slate-600 sm:text-sm">
            Step-by-step turn execution forensic analyzer, multi-agent goal drift tracking, and closed-loop mitigation diff.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 lg:justify-end">
          {/* Telemetry Statistics Counters */}
          <div className="grid grid-cols-3 gap-4 border-r border-slate-100 pr-4 sm:gap-6 sm:pr-6">
            <div>
              <p className="font-mono text-xl font-bold tabular-nums text-slate-900">{eventCount}</p>
              <p className="font-mono text-[9.5px] uppercase tracking-wider text-slate-500">Turns</p>
            </div>
            <div>
              <p
                className={cn(
                  "font-mono text-xl font-bold tabular-nums",
                  breachedCount > 0 ? "text-rose-600" : "text-emerald-600"
                )}
              >
                {breachedCount}
              </p>
              <p className="font-mono text-[9.5px] uppercase tracking-wider text-slate-500">Breaches</p>
            </div>
            <div>
              <p
                className={cn(
                  "font-mono text-xl font-bold tabular-nums",
                  peakSeverity === "CRITICAL"
                    ? "text-rose-600"
                    : peakSeverity === "HIGH"
                    ? "text-amber-600"
                    : "text-slate-900"
                )}
              >
                {peakRisk.toFixed(0)}
              </p>
              <p className="font-mono text-[9.5px] uppercase tracking-wider text-slate-500">Peak Risk</p>
            </div>
          </div>

          {/* Time Scrubber Controls */}
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 p-1 shadow-2xs">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-slate-600 hover:bg-white hover:text-slate-900 shadow-2xs"
              onClick={onPrev}
              disabled={!canPrev}
              aria-label="Previous event (ArrowUp or K)"
              title="Previous event · ↑ / K"
            >
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              className={cn(
                "h-8 w-8 text-white shadow-2xs transition-all",
                playing ? "bg-amber-600 hover:bg-amber-700" : "bg-black hover:bg-slate-900"
              )}
              onClick={onTogglePlay}
              disabled={eventCount === 0}
              aria-label={playing ? "Pause replay" : "Play replay"}
              title={playing ? "Pause · Space" : "Play · Space"}
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-slate-600 hover:bg-white hover:text-slate-900 shadow-2xs"
              onClick={onNext}
              disabled={!canNext}
              aria-label="Next event (ArrowDown or J)"
              title="Next event · ↓ / J"
            >
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Bottom Forensic Controls Ribbon */}
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-2.5 sm:px-6">
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-2xs"
          onClick={onExport}
          disabled={exportDisabled}
          title="Download forensic JSON replay trace"
        >
          <Download className="h-3 w-3 text-slate-500" />
          Export JSON
        </Button>

        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-2xs"
          onClick={onForensics}
          disabled={forensicsLoading || exportDisabled}
          title="Run statistical goal drift and privilege escalation analysis"
        >
          {forensicsLoading ? (
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          ) : (
            <Microscope className="h-3.5 w-3.5 text-blue-600" />
          )}
          Forensic Autopsy
        </Button>

        {selectedSession && (
          <Button
            asChild
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-2xs"
          >
            <Link href={`/logs?session=${encodeURIComponent(selectedSession.id)}`}>
              <ScrollText className="h-3.5 w-3.5 text-slate-500" />
              Open Logs
            </Link>
          </Button>
        )}

        {selectedSession?.status === "ACTIVE" && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-8 border-amber-200 bg-amber-50 text-xs font-medium text-amber-800 hover:bg-amber-100 shadow-2xs"
              disabled={actionLoading || sessionActionsDisabled}
              onClick={onQuarantine}
            >
              Quarantine Session
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-8 bg-rose-600 text-xs font-medium text-white hover:bg-rose-700 shadow-2xs"
              disabled={actionLoading || sessionActionsDisabled}
              onClick={onKill}
            >
              Stop Session
            </Button>
          </>
        )}

        {selectedSession && (
          <span className="ml-auto font-mono text-[10.5px] text-slate-500">
            {selectedSession.started_at
              ? new Date(selectedSession.started_at).toLocaleString()
              : "Start time unavailable"}
          </span>
        )}
      </div>
    </header>
  );
}
