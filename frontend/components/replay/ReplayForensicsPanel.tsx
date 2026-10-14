"use client";

import { cn } from "@/lib/utils";
import { Microscope, ShieldAlert, CheckCircle2, TrendingUp, Compass, Cpu } from "lucide-react";

interface ForensicsView {
  forensic_summary?: string;
  privilege_escalation_detected?: boolean;
  recon_duration_turns?: number;
  goal_drift_distance?: number;
  total_events?: number;
}

export function ReplayForensicsPanel({
  data,
  className,
  source = "live",
}: {
  data: Record<string, unknown>;
  className?: string;
  source?: "live" | "walkthrough";
}) {
  const f = data as ForensicsView;

  return (
    <div className={cn("rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-2 text-blue-700">
            <Microscope className="h-4 w-4" />
          </div>
          <div>
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
              {source === "live" ? "LIVE RUNTIME SYNTHESIS" : "FORENSIC SIMULATION AUTOPSY"}
            </span>
            <h3 className="text-base font-bold tracking-tight text-slate-950">
              Autonomous Agent Forensic Autopsy
            </h3>
          </div>
        </div>

        {f.privilege_escalation_detected ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-300 bg-rose-50 px-2.5 py-0.5 font-mono text-[10.5px] font-bold uppercase text-rose-700 shadow-2xs">
            <ShieldAlert className="h-3 w-3" />
            Privilege Escalation Intercepted
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 font-mono text-[10.5px] font-bold uppercase text-emerald-700 shadow-2xs">
            <CheckCircle2 className="h-3 w-3" />
            Normal Execution Envelope
          </span>
        )}
      </div>

      {f.forensic_summary && (
        <div className="rounded-lg border border-slate-200/80 bg-slate-50/60 p-3.5 text-xs leading-relaxed text-slate-700">
          <p className="font-sans font-medium text-slate-800 mb-1">Incident Summary &amp; MITRE Alignment:</p>
          <p className="font-sans text-slate-600">{f.forensic_summary}</p>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-200/80 bg-white p-3.5 shadow-2xs space-y-1">
          <dt className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Cpu className="h-3 w-3 text-slate-400" />
            Total Execution Hops
          </dt>
          <dd className="font-mono text-2xl font-bold tabular-nums text-slate-900">{f.total_events ?? "—"}</dd>
        </div>

        <div className="rounded-lg border border-slate-200/80 bg-white p-3.5 shadow-2xs space-y-1">
          <dt className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Compass className="h-3 w-3 text-slate-400" />
            Reconnaissance Duration
          </dt>
          <dd className="font-mono text-2xl font-bold tabular-nums text-slate-900">
            {f.recon_duration_turns ?? "—"} <span className="text-xs font-normal text-slate-500">hops</span>
          </dd>
        </div>

        <div className="rounded-lg border border-slate-200/80 bg-white p-3.5 shadow-2xs space-y-1">
          <dt className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <TrendingUp className="h-3 w-3 text-slate-400" />
            Goal Drift Distance
          </dt>
          <dd className="font-mono text-2xl font-bold tabular-nums text-slate-900">
            {Number.isFinite(f.goal_drift_distance) ? f.goal_drift_distance!.toFixed(2) : "—"}
          </dd>
        </div>

        <div className="rounded-lg border border-slate-200/80 bg-white p-3.5 shadow-2xs space-y-1">
          <dt className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <ShieldAlert className="h-3 w-3 text-slate-400" />
            Lateral Escalation
          </dt>
          <dd
            className={cn(
              "font-mono text-lg font-bold uppercase pt-0.5",
              f.privilege_escalation_detected ? "text-rose-600" : "text-emerald-600"
            )}
          >
            {f.privilege_escalation_detected ? "Detected & Blocked" : "None Detected"}
          </dd>
        </div>
      </dl>
    </div>
  );
}
