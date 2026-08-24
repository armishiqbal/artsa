"use client";

import { ShieldCheck, ShieldAlert, Target, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ScanMetrics } from "@/lib/redTeamScanMetrics";
import type { RiskBand } from "@/lib/redTeamRiskProfile";

const RISK_LABEL: Record<RiskBand, string> = {
  high: "High risk",
  medium: "Medium risk",
  low: "Low risk",
  none: "Pending",
};

const RISK_VARIANT: Record<RiskBand, "critical" | "warning" | "success" | "secondary"> = {
  high: "critical",
  medium: "warning",
  low: "success",
  none: "secondary",
};

interface RedTeamScanSummaryProps {
  metrics: ScanMetrics;
  visible: boolean;
  className?: string;
}

/** Lakera-style post-scan KPI strip — defense, findings, risk band. */
export function RedTeamScanSummary({ metrics, visible, className }: RedTeamScanSummaryProps) {
  if (!visible) return null;

  const tiles = [
    {
      label: "Defense quality",
      value: metrics.avgDefenseQuality,
      icon: ShieldCheck,
      accent: "text-status-success",
    },
    {
      label: "Attack success",
      value: metrics.avgAttackSuccess,
      icon: Target,
      accent: "text-severity-high",
    },
    {
      label: "Findings",
      value: String(metrics.findingsCount),
      icon: ShieldAlert,
      accent: metrics.findingsCount > 0 ? "text-severity-high" : "text-muted-foreground",
    },
    {
      label: "Bypass depth",
      value: metrics.avgBypassDepth,
      icon: Layers,
      accent: "text-foreground",
    },
  ];

  return (
    <div className={cn("red-team-scan-summary border-b border-border px-4 py-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold tracking-tight">Scan snapshot</p>
          <Badge variant={RISK_VARIANT[metrics.riskBand]} className="meta-badge">
            {RISK_LABEL[metrics.riskBand]}
          </Badge>
          {metrics.roundsCompleted > 0 && (
            <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
              {metrics.roundsCompleted} rounds · {metrics.blockedCount} blocked · {metrics.successCount} breached
            </span>
          )}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="rounded-lg border border-border/80 bg-card/50 px-3 py-2.5"
          >
            <div className="flex items-center gap-1.5">
              <tile.icon className={cn("h-3.5 w-3.5", tile.accent)} aria-hidden />
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {tile.label}
              </p>
            </div>
            <p className="mt-1 font-mono text-xl font-semibold tabular-nums leading-none">
              {tile.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
