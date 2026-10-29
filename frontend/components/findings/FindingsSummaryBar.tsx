"use client";

import {
  BookMarked,
  Download,
  FileCode2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ExtendedFinding } from "@/lib/types/findings";

interface FindingsSummaryBarProps {
  findings: ExtendedFinding[];
  playbookVersion: number;
  loading?: boolean;
  unavailable?: boolean;
  onExport: () => void;
  onExportSarif?: () => void;
}

export function FindingsSummaryBar({
  findings,
  playbookVersion,
  loading = false,
  unavailable = false,
  onExport,
  onExportSarif,
}: FindingsSummaryBarProps) {
  const total = findings.length;
  const criticalCount = findings.filter((f) => f.severity === "CRITICAL").length;
  const highCount = findings.filter((f) => f.severity === "HIGH").length;
  const breachedCount = findings.filter((f) => f.verdict?.toUpperCase() === "BREACHED").length;
  const containedCount = findings.filter((f) => f.verdict?.toUpperCase() === "CONTAINED").length;
  const promotedCount = findings.filter((f) => f.status === "promoted" || Boolean(f.promoted_rule_name)).length;

  return (
    <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs space-y-3.5">
      {/* Data provenance */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-100 font-mono text-[11px]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex h-2 w-2 relative shrink-0">
            <span className={unavailable ? "relative inline-flex h-2 w-2 rounded-full bg-rose-500" : loading ? "relative inline-flex h-2 w-2 rounded-full bg-amber-500" : "relative inline-flex h-2 w-2 rounded-full bg-emerald-500"} />
          </span>
          <span className="font-bold uppercase tracking-wider text-slate-800">
            {unavailable ? "BACKEND DATA UNAVAILABLE" : loading ? "LOADING BACKEND FINDINGS" : "BACKEND FINDINGS"}
          </span>
          <span className="text-slate-300 hidden sm:inline">|</span>
          <span className="text-slate-500">
            Records returned: <strong className="text-slate-800">{unavailable || loading ? "—" : total}</strong>
          </span>
        </div>

        <div className="flex items-center gap-3 text-slate-500">
          <span>Playbook version: <strong className="text-slate-800">{unavailable || loading ? "—" : "v" + playbookVersion}</strong></span>
        </div>
      </div>

      {/* Main KPI Matrix & Action Strip */}
      <div className="flex flex-col gap-3.5 xl:flex-row xl:items-center xl:justify-between">
        {/* KPI Grid: 2 cols on mobile, 4 cols on tablet & desktop */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3 flex-1">
          {/* Card 1: Backend finding count */}
          <div className="rounded-lg border border-slate-200/80 bg-slate-50/60 p-2.5 sm:p-3 transition-colors hover:bg-slate-50">
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Total findings
            </p>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="font-mono text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                {unavailable || loading ? "—" : total}
              </span>
              <span className="font-mono text-[10px] text-slate-500">vectors</span>
            </div>
          </div>

          {/* Card 2: Severity counts */}
          <div className="rounded-lg border border-slate-200/80 bg-slate-50/60 p-2.5 sm:p-3 transition-colors hover:bg-slate-50">
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Critical / High
            </p>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="font-mono text-xl sm:text-2xl font-bold tracking-tight text-rose-600">
                {unavailable || loading ? "—" : criticalCount}
              </span>
              <span className="font-mono text-sm font-semibold text-slate-400">/</span>
              <span className="font-mono text-lg font-bold text-amber-600">
                {unavailable || loading ? "—" : highCount}
              </span>
            </div>
          </div>

          {/* Card 3: Backend verdict counts */}
          <div className="rounded-lg border border-slate-200/80 bg-slate-50/60 p-2.5 sm:p-3 transition-colors hover:bg-slate-50">
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Breached / Contained
            </p>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="font-mono text-xl sm:text-2xl font-bold tracking-tight text-rose-600">
                {unavailable || loading ? "—" : breachedCount}
              </span>
              <span className="font-mono text-sm font-semibold text-slate-400">/</span>
              <span className="font-mono text-lg font-bold text-emerald-600">
                {unavailable || loading ? "—" : containedCount}
              </span>
            </div>
          </div>

          {/* Card 4: Active Playbook Defense */}
          <div className="rounded-lg border border-slate-200/80 bg-slate-50/60 p-2.5 sm:p-3 transition-colors hover:bg-slate-50">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Active Playbook
              </p>
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-emerald-100 text-emerald-700">
                <BookMarked className="h-3 w-3" />
              </div>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="font-mono text-lg sm:text-xl font-bold tracking-tight text-slate-900">
                {unavailable || loading ? "—" : "v" + playbookVersion}
              </span>
              <span className="font-mono text-[10px] text-slate-500 truncate">
                ({promotedCount} enforced)
              </span>
            </div>
          </div>
        </div>

        {/* Right: Quick Operational Actions */}
        <div className="flex flex-row items-center gap-2 shrink-0 pt-1 xl:pt-0">
          <Button
            size="sm"
            variant="outline"
            onClick={onExportSarif ?? onExport}
            className="flex-1 sm:flex-initial h-8.5 gap-1.5 border-slate-200 bg-white font-mono text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900"
            title="Export OASIS SARIF v2.1.0 standard for GitHub/GitLab Security"
          >
            <FileCode2 className="h-3.5 w-3.5 text-slate-500" />
            <span className="hidden xs:inline">Export </span>SARIF 2.1
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={onExport}
            className="flex-1 sm:flex-initial h-8.5 gap-1.5 border-slate-200 bg-white font-mono text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span className="hidden xs:inline">Export </span>JSON
          </Button>
        </div>
      </div>
    </div>
  );
}
