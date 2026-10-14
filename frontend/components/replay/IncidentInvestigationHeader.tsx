"use client";

import Link from "next/link";
import {
  ShieldAlert,
  ShieldCheck,
  Download,
  ScrollText,
  ChevronDown,
  AlertTriangle,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Session } from "@/lib/types";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

export function IncidentInvestigationHeader({
  sessions,
  selectedSession,
  selectedSessionId,
  onSelectSession,
  peakRisk,
  breachedCount,
  eventCount,
  onExport,
  exportDisabled,
  actionLoading,
  onQuarantine,
  onKill,
}: {
  sessions: Session[];
  selectedSession: Session | undefined;
  selectedSessionId: string | null;
  onSelectSession: (id: string) => void;
  peakRisk: number;
  breachedCount: number;
  eventCount: number;
  onExport: () => void;
  exportDisabled: boolean;
  actionLoading: boolean;
  onQuarantine: () => void;
  onKill: () => void;
}) {
  const isBreached = selectedSession?.status === "BREACHED" || peakRisk >= 75;

  return (
    <header className="rounded-xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden transition-colors">
      {/* Top SOC Investigation Metadata Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-2.5 sm:px-6">
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
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-slate-700">
            ARTSA THREAT INVESTIGATION <span className="text-slate-300">/</span> AGENT ATTACK PATH
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Incident Severity Pill */}
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10.5px] font-semibold uppercase shadow-2xs",
              isBreached
                ? "border-rose-300 bg-rose-50 text-rose-700"
                : "border-emerald-300 bg-emerald-50 text-emerald-700"
            )}
          >
            {isBreached ? <ShieldAlert className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
            {!selectedSession ? "NO SESSION" : isBreached ? "BREACH EVIDENCE" : selectedSession.status}
          </span>

          {selectedSession?.circuit_breaker_open && (
            <span className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase text-rose-700 shadow-2xs">
              <Lock className="h-3 w-3" />
              Circuit Breaker Tripped
            </span>
          )}

          <Badge variant="outline" className="font-mono text-[10px] uppercase border-slate-200 bg-white text-slate-600 shadow-2xs">
            {eventCount} Execution Hops
          </Badge>
        </div>
      </div>

      {/* Main Incident Dossier & Agent Context */}
      <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">
              {selectedSession?.agent_id ?? "Agent Execution Investigation"}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
            <span>
              <strong className="text-slate-800">Agent:</strong> {selectedSession?.agent_id ?? "—"}
            </span>
            {selectedSession ? <span>•</span> : null}
            <span>
              <strong className="text-slate-800">Session ID:</strong>{" "}
              <code className="font-mono text-[11px] text-slate-700">{selectedSessionId ?? "—"}</code>
            </span>
          </div>

          {/* Quick Incident Switcher Dropdown */}
          {sessions.length > 0 && (
            <div className="mt-2 flex max-w-xl items-center gap-2 pt-1">
              <label htmlFor="incident-select" className="sr-only">
                Switch Security Incident
              </label>
              <div className="relative min-w-0 flex-1">
                <select
                  id="incident-select"
                  value={selectedSessionId ?? ""}
                  onChange={(e) => onSelectSession(e.target.value)}
                  className="h-8 w-full appearance-none rounded-lg border border-slate-200 bg-slate-50/70 pl-3 pr-8 font-mono text-xs text-slate-900 outline-none transition-colors hover:border-slate-300 focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.agent_id} · {s.status} ({s.tool_call_count} stored events, risk {s.max_risk_score ?? "—"})
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
          )}
        </div>

        {/* Telemetry Stats & Response Actions */}
        <div className="flex flex-wrap items-center gap-5 lg:justify-end">
          <div className="grid grid-cols-3 gap-5 border-r border-slate-100 pr-5">
            <div>
              <p className="font-mono text-2xl font-bold tabular-nums text-slate-900">{eventCount}</p>
              <p className="font-mono text-[9.5px] uppercase tracking-wider text-slate-500">Total Hops</p>
            </div>
            <div>
              <p
                className={cn(
                  "font-mono text-2xl font-bold tabular-nums",
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
                  "font-mono text-2xl font-bold tabular-nums",
                  peakRisk >= 75 ? "text-rose-600" : peakRisk >= 40 ? "text-amber-600" : "text-slate-900"
                )}
              >
                {Number.isFinite(peakRisk) ? peakRisk.toFixed(0) : "—"}
              </p>
              <p className="font-mono text-[9.5px] uppercase tracking-wider text-slate-500">Peak Threat</p>
            </div>
          </div>

          {/* SecOps Containment Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-2xs"
              onClick={onExport}
              disabled={exportDisabled}
              title="Download forensic JSON audit package"
            >
              <Download className="h-3 w-3 text-slate-500" />
              Export Audit
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
                  Audit Logs
                </Link>
              </Button>
            )}

            {selectedSession?.status === "ACTIVE" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 border-amber-300 bg-amber-50 text-xs font-medium text-amber-800 hover:bg-amber-100 shadow-2xs"
                  disabled={actionLoading}
                  onClick={onQuarantine}
                >
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  Quarantine Session
                </Button>
                <Button
                  size="sm"
                  className="h-8 bg-rose-600 text-xs font-medium text-white hover:bg-rose-700 shadow-2xs"
                  disabled={actionLoading}
                  onClick={onKill}
                >
                  <Lock className="mr-1 h-3 w-3" />
                  Kill Session
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 bg-slate-50/50 px-5 py-2.5 sm:px-6 text-xs text-slate-600">
        <span className="font-mono text-[10.5px] text-slate-500">
          {selectedSession?.started_at
            ? `Session started: ${formatDateTime(selectedSession.started_at)}`
            : "No blast-radius or session-start evidence is available."}
        </span>
      </div>
    </header>
  );
}
