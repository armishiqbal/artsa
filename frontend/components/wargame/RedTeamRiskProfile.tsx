"use client";

import { ShieldAlert } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  buildCategoryRiskProfile,
  overallRiskBand,
  type CategoryRiskRow,
  type RiskBand,
} from "@/lib/redTeamRiskProfile";
import type { TranscriptTurn } from "@/lib/campaignTranscript";

const BAND_LABEL: Record<RiskBand, string> = {
  high: "High risk",
  medium: "Medium risk",
  low: "Low risk",
  none: "No data",
};

const BAND_VARIANT: Record<RiskBand, "critical" | "warning" | "success" | "secondary"> = {
  high: "critical",
  medium: "warning",
  low: "success",
  none: "secondary",
};

const BAND_BAR: Record<RiskBand, string> = {
  high: "[&>div]:bg-severity-critical",
  medium: "[&>div]:bg-severity-medium",
  low: "[&>div]:bg-status-success",
  none: "",
};

interface RedTeamRiskProfileProps {
  turns: TranscriptTurn[];
  className?: string;
}

function RiskRow({ row }: { row: CategoryRiskRow }) {
  const pct = Math.min(100, Math.round((row.avgAttackSuccess / 10) * 100));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="truncate text-muted-foreground">
          {row.asiCode ? (
            <span className="font-mono text-[10px] text-foreground/80">{row.asiCode}</span>
          ) : null}
          <span className="ml-1">{row.label}</span>
        </span>
        <span className="shrink-0 font-mono tabular-nums text-foreground">
          {row.avgAttackSuccess.toFixed(1)}
        </span>
      </div>
      <Progress value={pct} className={cn("h-1", BAND_BAR[row.band])} />
      <p className="text-[10px] text-muted-foreground">
        {row.successCount}/{row.rounds} successful attacks
      </p>
    </div>
  );
}

/** Lakera-style asset risk profile — category vulnerability bars. */
export function RedTeamRiskProfile({ turns, className }: RedTeamRiskProfileProps) {
  const rows = buildCategoryRiskProfile(turns);
  const band = overallRiskBand(rows);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <p className="text-xs font-semibold tracking-tight">Asset risk profile</p>
        </div>
        {rows.length > 0 && (
          <Badge variant={BAND_VARIANT[band]} className="meta-badge">
            {BAND_LABEL[band]}
          </Badge>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Run a scan to map vulnerabilities across OWASP Agentic categories.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => <RiskRow key={row.key} row={row} />)}
        </div>
      )}
    </div>
  );
}
