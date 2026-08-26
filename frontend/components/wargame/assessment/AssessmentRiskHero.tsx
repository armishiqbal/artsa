"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AssessmentRiskOverview, AssessmentSeverity } from "@/lib/assessmentResults";

const SEVERITY_VARIANT: Record<
  AssessmentSeverity,
  "secondary" | "success" | "warning" | "critical" | "outline"
> = {
  None: "secondary",
  Low: "success",
  Medium: "warning",
  High: "critical",
  Critical: "critical",
};

interface AssessmentRiskHeroProps {
  overview: AssessmentRiskOverview;
  title?: string;
  subtitle?: string;
  className?: string;
  actions?: ReactNode;
}

export function AssessmentRiskHero({
  overview,
  title,
  subtitle,
  className,
  actions,
}: AssessmentRiskHeroProps) {
  const empty = overview.totalEvaluations === 0;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-[#313131] bg-[#0a0a0a]",
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#313131] px-4 py-3 sm:px-5">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#6798ff]">
            Scan results
          </p>
          {title ? (
            <h2 className="mt-1 text-base font-semibold tracking-tight text-white">{title}</h2>
          ) : null}
          {subtitle ? (
            <p className="mt-0.5 font-mono text-[11px] text-[#7c7c7c]">{subtitle}</p>
          ) : null}
        </div>
        {actions}
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-[minmax(0,180px)_1fr] sm:items-center sm:p-5">
        <div className="text-center sm:text-left">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#7c7c7c]">
            Risk score
          </p>
          <p
            className={cn(
              "mt-1 font-mono text-5xl font-semibold tabular-nums tracking-tight",
              empty ? "text-[#454545]" : "text-white"
            )}
          >
            {empty ? "—" : `${overview.riskScore}%`}
          </p>
          {!empty && (
            <Badge variant={SEVERITY_VARIANT[overview.severity]} className="meta-badge mt-2">
              {overview.severity}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Metric label="Objectives tested" value={String(overview.objectivesTested)} />
          <Metric
            label="Harmful"
            value={String(overview.harmfulCount)}
            tone="text-[hsl(var(--severity-critical))]"
          />
          <Metric
            label="Safe"
            value={String(overview.safeCount)}
            tone="text-[#4ade80]"
          />
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-[8px] border border-[#313131] bg-[#141414] px-3 py-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.06em] text-[#454545]">{label}</p>
      <p className={cn("mt-1 font-mono text-xl font-semibold tabular-nums text-white", tone)}>
        {value}
      </p>
    </div>
  );
}
