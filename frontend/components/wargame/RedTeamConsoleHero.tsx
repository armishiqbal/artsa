"use client";

import Link from "next/link";
import { Play, Loader2, BookOpen, Target, Swords, ShieldCheck, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LiveIndicator } from "@/components/shared/LiveIndicator";
import { cn } from "@/lib/utils";
import type { ScanMetrics } from "@/lib/redTeamScanMetrics";
import type { RiskBand } from "@/lib/redTeamRiskProfile";

const RISK_LABEL: Record<RiskBand, string> = {
  high: "High risk asset",
  medium: "Medium risk",
  low: "Low risk",
  none: "Not scanned",
};

interface RedTeamConsoleHeroProps {
  isRunning: boolean;
  completed: boolean;
  canLaunch: boolean;
  onLaunch: () => void;
  targetName?: string | null;
  targetModel?: string | null;
  scanModeLabel?: string;
  rounds?: number;
  metrics?: ScanMetrics | null;
  className?: string;
}

/** Red Team — command strip with target chip, live KPIs, and primary scan CTA. */
export function RedTeamConsoleHero({
  isRunning,
  completed,
  canLaunch,
  onLaunch,
  targetName,
  targetModel,
  scanModeLabel,
  rounds,
  metrics,
  className,
}: RedTeamConsoleHeroProps) {
  const hasMetrics = metrics && metrics.roundsCompleted > 0;

  return (
    <div
      className={cn(
        "red-team-hero relative overflow-hidden rounded-xl border border-border px-4 py-4 sm:px-5 sm:py-5",
        isRunning && "red-team-hero--live",
        className
      )}
    >
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/80 bg-background/60 shadow-sm">
              <Swords className="h-5 w-5 text-foreground" aria-hidden />
            </div>
            <div>
              <p className="text-base font-semibold tracking-tight">Adversarial evaluation</p>
              <p className="text-xs text-muted-foreground max-w-xl">
                Continuous red teaming for LLM apps and agents — scope targets, run multi-turn
                attacks, map OWASP Agentic risk before production.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isRunning ? (
              <LiveIndicator connected label="Scan in progress" className="meta-badge" />
            ) : completed ? (
              <Badge variant="success" className="meta-badge">Last scan complete</Badge>
            ) : null}
            {hasMetrics && metrics.riskBand !== "none" && (
              <Badge
                variant={
                  metrics.riskBand === "high"
                    ? "critical"
                    : metrics.riskBand === "medium"
                      ? "warning"
                      : "success"
                }
                className="meta-badge"
              >
                {RISK_LABEL[metrics.riskBand]}
              </Badge>
            )}
            {targetName ? (
              <Badge variant="secondary" className="meta-badge gap-1 font-normal">
                <Target className="h-3 w-3" aria-hidden />
                {targetName}
                {targetModel ? ` · ${targetModel}` : ""}
              </Badge>
            ) : (
              <Badge variant="outline" className="meta-badge font-normal">No target selected</Badge>
            )}
            {scanModeLabel && (
              <Badge variant="outline" className="meta-badge font-normal">{scanModeLabel}</Badge>
            )}
            {rounds != null && (
              <Badge variant="outline" className="meta-badge font-mono tabular-nums">
                {rounds} turns
              </Badge>
            )}
          </div>

          {hasMetrics && (
            <div className="flex flex-wrap gap-3 font-mono text-[11px] tabular-nums text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-status-success" aria-hidden />
                Defense {metrics.avgDefenseQuality}
              </span>
              <span className="inline-flex items-center gap-1">
                <Target className="h-3 w-3" aria-hidden />
                Attack {metrics.avgAttackSuccess}
              </span>
              <span className="inline-flex items-center gap-1">
                <ShieldAlert className="h-3 w-3 text-severity-high" aria-hidden />
                {metrics.findingsCount} finding{metrics.findingsCount === 1 ? "" : "s"}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button asChild variant="outline" size="sm">
            <Link href="/library">
              <BookOpen className="h-3.5 w-3.5" />
              Attack library
            </Link>
          </Button>
          <Button onClick={onLaunch} disabled={!canLaunch} size="default" className="gap-2 min-w-[148px]">
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Scanning…
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Start scan
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
