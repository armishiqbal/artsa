"use client";

import {
  ShieldAlert,
  Activity,
  Lock,
  Server,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Session } from "@/lib/types";

export function ActivityAuditSummaryBar({
  session,
  totalEvents,
  breachedEvents,
  peakRisk,
  onQuarantine,
  onKill,
  actionLoading,
}: {
  session?: Session;
  totalEvents: number;
  breachedEvents: number;
  peakRisk: number | null;
  onQuarantine: () => void;
  onKill: () => void;
  actionLoading: boolean;
}) {
  const isBreached = breachedEvents > 0 || (peakRisk != null && peakRisk >= 75);

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-[0_1px_3px_rgba(15,23,42,0.03)] space-y-4">
      {/* Top Identity Profile & SecOps Status */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-xs",
              isBreached
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-slate-200 bg-slate-50 text-slate-700"
            )}
          >
            {isBreached ? <ShieldAlert className="h-5 w-5" /> : <Server className="h-5 w-5" />}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 tracking-tight sm:text-lg">
                {session?.agent_id ?? "No session selected"}
              </h1>
              <span
                className={cn(
                  "font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded border",
                  !session
                    ? "border-slate-200 bg-slate-50 text-slate-600"
                    : isBreached
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                )}
              >
                {!session ? "No session" : isBreached ? "Threat evidence present" : session.status}
              </span>
            </div>
            <p className="font-mono text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
              <span>Tenant: {session?.tenant_id ?? "—"}</span>
              {session ? <span>Session: {session.id}</span> : null}
            </p>
          </div>
        </div>

        {/* Rapid Containment Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={actionLoading || !session}
            onClick={onQuarantine}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-1.5 font-mono text-xs font-semibold text-amber-800 hover:bg-amber-100 transition-colors shadow-2xs disabled:opacity-50"
          >
            <Lock className="h-3.5 w-3.5 text-amber-600" />
            Quarantine Session
          </button>
          <button
            type="button"
            disabled={actionLoading || !session}
            onClick={onKill}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-600 px-3 py-1.5 font-mono text-xs font-semibold text-white hover:bg-rose-700 transition-colors shadow-2xs disabled:opacity-50"
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            Kill Session
          </button>
        </div>
      </div>

      {/* 4 Obsidian-Style Audit Metric Tiles */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10.5px] uppercase font-semibold text-slate-500">
              Total Audited Actions
            </span>
            <Activity className="h-3.5 w-3.5 text-blue-600" />
          </div>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900">
            {totalEvents}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Recorded events for this session</p>
        </div>

        <div className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10.5px] uppercase font-semibold text-slate-500">
              Maximum Recorded Risk
            </span>
            <ShieldAlert className={cn("h-3.5 w-3.5", peakRisk != null && peakRisk >= 75 ? "text-rose-600" : "text-amber-600")} />
          </div>
          <p
            className={cn(
              "mt-1 font-mono text-2xl font-bold tabular-nums",
              peakRisk != null && peakRisk >= 75 ? "text-rose-600" : peakRisk != null && peakRisk >= 40 ? "text-amber-600" : "text-slate-900"
            )}
          >
            {peakRisk == null ? "—" : peakRisk.toFixed(0)} <span className="text-xs font-normal text-slate-400">{peakRisk == null ? "" : "/ 100"}</span>
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Maximum stored risk score</p>
        </div>

        <div className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10.5px] uppercase font-semibold text-slate-500">
              Stored Breach Verdicts
            </span>
            <Lock className="h-3.5 w-3.5 text-rose-600" />
          </div>
          <p
            className={cn(
              "mt-1 font-mono text-2xl font-bold tabular-nums",
              breachedEvents > 0 ? "text-rose-600" : "text-emerald-600"
            )}
          >
            {breachedEvents}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Events with a stored BREACHED verdict</p>
        </div>
      </div>
    </div>
  );
}
