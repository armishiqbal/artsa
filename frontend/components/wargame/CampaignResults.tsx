"use client";

import Link from "next/link";
import { useState } from "react";
import { BarChart3, CheckCircle2, Download, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { saveWargameReadinessRecord } from "@/lib/campaignReadiness";
import { PromoteToPlaybookPanel } from "@/components/wargame/PromoteToPlaybookPanel";
import type { TranscriptTurn } from "@/lib/campaignTranscript";

const CATEGORY_LABELS: Record<string, string> = {
  DPI: "Prompt injection",
  JBK: "Jailbreak",
  SPE: "System prompt extraction",
  DEX: "Data extraction",
  MSE: "Model supply chain",
  PROMPT_INJECTION: "Prompt injection",
  JAILBREAK: "Jailbreak",
  SYSTEM_PROMPT_EXTRACTION: "System prompt extraction",
  DATA_EXTRACTION: "Data extraction",
};

function num(value: unknown, digits = 1): string {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : "—";
}

function verdictTotal(verdicts: Record<string, unknown>): number {
  return Object.values(verdicts).reduce<number>((acc, v) => acc + (Number(v) || 0), 0);
}

export function CampaignResults({
  summary,
  campaignId,
  featuredTurn,
  className,
}: {
  summary: Record<string, unknown>;
  campaignId?: string | null;
  featuredTurn?: TranscriptTurn | null;
  className?: string;
}) {
  const [saved, setSaved] = useState(false);
  const verdicts = (summary.results_by_verdict as Record<string, unknown>) ?? {};
  const categories = (summary.results_by_category as Record<string, Record<string, unknown>>) ?? {};
  const totalVerdicts = verdictTotal(verdicts) || 1;
  const completed = summary.completed_rounds ?? summary.total_rounds ?? 0;

  const handleAddToReadiness = () => {
    if (!campaignId) return;
    saveWargameReadinessRecord({
      campaign_id: campaignId,
      completed_at: new Date().toISOString(),
      summary,
    });
    setSaved(true);
  };

  return (
    <div className={cn("space-y-5 animate-panel-in", className)}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Rounds</p>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{String(completed)}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Attack success</p>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
            {num(summary.avg_attack_success)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Defense quality</p>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-status-success">
            {num(summary.avg_defense_quality)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Bypass depth</p>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
            {num(summary.avg_bypass_depth)}
          </p>
        </div>
      </div>

      {Object.keys(verdicts).length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-foreground">Verdict breakdown</h3>
          <div className="mt-3 space-y-2">
            {Object.entries(verdicts).map(([verdict, count]) => {
              const n = Number(count) || 0;
              const pct = Math.round((n / totalVerdicts) * 100);
              const isSuccess = verdict.toUpperCase().includes("SUCCESS");
              return (
                <div key={verdict} className="space-y-1">
                  <div className="flex justify-between font-mono text-[11px]">
                    <span className="text-muted-foreground">{verdict}</span>
                    <span className="tabular-nums">{n} · {pct}%</span>
                  </div>
                  <Progress
                    value={pct}
                    className={cn("h-1.5", isSuccess && "[&>div]:bg-severity-high")}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {Object.keys(categories).length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-foreground">By attack category</h3>
          <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
            {Object.entries(categories).map(([code, stats]) => (
              <li key={code} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                <span className="text-muted-foreground">
                  {CATEGORY_LABELS[code] ?? code}
                </span>
                <span className="font-mono tabular-nums text-foreground">
                  {num(stats?.avg_success ?? stats?.success_rate, 0)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {featuredTurn && (
        <PromoteToPlaybookPanel turn={featuredTurn} className="border-t border-border pt-4" />
      )}

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        {campaignId && (
          saved ? (
            <div className="flex items-center gap-2 text-xs text-status-success">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Added to readiness export
            </div>
          ) : (
            <Button size="sm" variant="default" onClick={handleAddToReadiness}>
              <Download className="h-3.5 w-3.5" />
              Add to readiness export
            </Button>
          )
        )}
        <Button asChild size="sm" variant="outline">
          <Link href="/get-started">
            <Download className="h-3.5 w-3.5" />
            Export on Get Started
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/reports">
            <BarChart3 className="h-3.5 w-3.5" />
            Full report
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href={campaignId ? `/replay?session=${encodeURIComponent(campaignId)}` : "/replay"}>
            <ScrollText className="h-3.5 w-3.5" />
            Session replay
          </Link>
        </Button>
      </div>
    </div>
  );
}
