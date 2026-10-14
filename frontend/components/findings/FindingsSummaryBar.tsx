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
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 font-mono text-[11px]">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className={unavailable ? "relative inline-flex h-2 w-2 rounded-full bg-rose-500" : loading ? "relative inline-flex h-2 w-2 rounded-full bg-amber-500" : "relative inline-flex h-2 w-2 rounded-full bg-emerald-500"} />
          </span>
          <span className="font-bold uppercase tracking-wider text-slate-800">
            {unavailable ? "BACKEND DATA UNAVAILABLE" : loading ? "LOADING BACKEND FINDINGS" : "BACKEND FINDINGS"}
          </span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500">Records returned: <strong className="text-slate-800">{unavailable || loading ? "—" : total}</strong></span>
        </div>

        <div className="flex items-center gap-3 text-slate-500">
          <span>Playbook version: <strong className="text-slate-800">{unavailable || loading ? "—" : "v" + playbookVersion}</strong></span>
        </div>
      </div>

      {/* Main KPI Matrix */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: Primary Identity & KPI strip */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          {/* Backend finding count */}
          <div className="flex items-center gap-3 pr-4 border-r border-slate-200">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Total findings
              </p>
              <span className="font-mono text-xl font-bold tracking-tight text-slate-900">{unavailable || loading ? "—" : total}</span>
            </div>
          </div>

          {/* Severity counts */}
          <div className="flex items-center gap-2.5 pr-4 border-r border-slate-200">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Critical / High
              </p>
              <p className="font-mono text-base font-bold text-slate-900">{unavailable || loading ? "—" : criticalCount + " / " + highCount}</p>
            </div>
          </div>

          {/* Backend verdict counts */}
          <div className="flex items-center gap-2.5 pr-4 border-r border-slate-200">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Breached / Contained
              </p>
              <p className="font-mono text-base font-bold text-slate-900">{unavailable || loading ? "—" : breachedCount + " / " + containedCount}</p>
            </div>
          </div>

          {/* Active Playbook Defense */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-600">
              <BookMarked className="h-4 w-4" />
            </div>
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Active Playbook
              </p>
              <p className="font-mono text-base font-bold text-slate-900">
                {unavailable || loading ? "—" : "v" + playbookVersion}{" "}
                <span className="text-[11px] font-normal text-slate-500">({promotedCount} enforced)</span>
              </p>
            </div>
          </div>
        </div>

        {/* Right: Quick Operational Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onExportSarif ?? onExport}
            className="h-8 gap-1.5 border-slate-200 bg-white font-mono text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900"
            title="Export OASIS SARIF v2.1.0 standard for GitHub/GitLab Security"
          >
            <FileCode2 className="h-3.5 w-3.5 text-slate-500" />
            Export SARIF 2.1
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={onExport}
            className="h-8 gap-1.5 border-slate-200 bg-white font-mono text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            Export JSON
          </Button>
        </div>
      </div>
    </div>
  );
}
