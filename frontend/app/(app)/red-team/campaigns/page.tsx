"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CampaignCohortHero } from "@/components/red-team/CampaignCohortHero";
import { CampaignWatchFloor } from "@/components/red-team/CampaignWatchFloor";
import {
  friendlyStatus,
  RedTeamGlossary,
  RedTeamSimpleSteps,
} from "@/components/red-team/RedTeamGlossary";
import { RedTeamScanWizard } from "@/components/wargame/RedTeamScanWizard";
import { riskScoreFromSummary } from "@/lib/assessmentResults";
import { useAuthRole } from "@/lib/hooks/useAuthRole";
import { useCampaigns, type CampaignListItem } from "@/lib/hooks/useCampaigns";
import { deriveRedTeamOverview } from "@/lib/redTeamOverview";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "running" | "completed" | "failed" | "lab";
type SortKey = "risk" | "status" | "name" | "progress";

function statusBucket(status: string): "running" | "completed" | "failed" | "other" {
  const s = status.toUpperCase();
  if (s === "RUNNING" || s === "PENDING") return "running";
  if (s === "COMPLETED") return "completed";
  if (s === "FAILED" || s === "ERROR" || s === "CANCELLED") return "failed";
  return "other";
}

function isLabRun(c: CampaignListItem): boolean {
  return String(c.name || "").startsWith("Lab ·");
}

function CampaignRow({ campaign }: { campaign: CampaignListItem }) {
  const risk = riskScoreFromSummary(campaign.summary ?? null);
  const bucket = statusBucket(campaign.status);
  const total = Math.max(1, Number(campaign.total_rounds || 1));
  const done = Number(campaign.rounds_completed || 0);
  const pct = Math.min(100, Math.round((done / total) * 100));

  return (
    <li className="border-b border-border last:border-0">
      <div className="grid gap-3 px-3 py-3 sm:grid-cols-[minmax(0,1.5fr)_7rem_6rem_5rem_auto] sm:items-center">
        <Link href={`/red-team/monitor/${campaign.id}`} className="min-w-0 group">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                bucket === "running" && "animate-pulse bg-primary",
                bucket === "completed" && "bg-[hsl(var(--severity-low))]",
                bucket === "failed" && "bg-[hsl(var(--severity-critical))]",
                bucket === "other" && "bg-muted-foreground/40"
              )}
              aria-hidden
            />
            <span className="truncate text-[13px] font-medium group-hover:underline">
              {campaign.name}
            </span>
            {isLabRun(campaign) ? (
              <span className="shrink-0 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                lab
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
            {campaign.provider}/{campaign.model}
            {campaign.error ? ` · ${String(campaign.error).slice(0, 48)}` : ""}
          </p>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted sm:hidden">
            <div
              className={cn(
                "h-full rounded-full",
                bucket === "failed"
                  ? "bg-[hsl(var(--severity-critical))]"
                  : "bg-foreground/45"
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </Link>

        <div className="hidden sm:block">
          <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {done}/{campaign.total_rounds} · {pct}%
          </p>
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full",
                bucket === "failed"
                  ? "bg-[hsl(var(--severity-critical))]"
                  : bucket === "running"
                    ? "bg-primary"
                    : "bg-foreground/45"
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <span
          className={cn(
            "text-[12px]",
            bucket === "failed" && "text-[hsl(var(--severity-critical))]",
            bucket === "running" && "text-primary",
            bucket === "completed" && "text-[hsl(var(--severity-low))]",
            bucket === "other" && "text-muted-foreground"
          )}
        >
          {friendlyStatus(campaign.status)}
        </span>

        <span
          className={cn(
            "tabular-nums text-[13px]",
            risk != null && risk >= 80
              ? "text-[hsl(var(--severity-critical))]"
              : "text-foreground"
          )}
        >
          {risk != null ? `${risk}/100` : "—"}
        </span>

        <div className="flex flex-wrap gap-1.5 sm:justify-end">
          <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" asChild>
            <Link href={`/red-team/monitor/${campaign.id}?follow=1`}>Watch</Link>
          </Button>
        </div>
      </div>
    </li>
  );
}

function RedTeamCampaignsInner() {
  const searchParams = useSearchParams();
  const { capabilities, loading: authLoading } = useAuthRole();
  const { campaigns, loading, refresh } = useCampaigns();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("risk");

  useEffect(() => {
    if (searchParams.get("new") === "1") setWizardOpen(true);
  }, [searchParams]);

  const overview = useMemo(() => deriveRedTeamOverview(campaigns), [campaigns]);

  const cohort = useMemo(() => {
    const risks = overview.campaignRisk.map((c) => c.risk).filter((r) => r > 0);
    const meanRisk =
      risks.length > 0
        ? Math.round((risks.reduce((a, b) => a + b, 0) / risks.length) * 10) / 10
        : null;
    const maxRisk = risks.length > 0 ? Math.max(...risks) : 0;
    const labCount = campaigns.filter(isLabRun).length;
    const assessmentCount = campaigns.length - labCount;
    const failed = campaigns.filter((c) => statusBucket(c.status) === "failed").length;
    let finding =
      campaigns.length === 0
        ? "No tests yet. Start a quick test or build a custom one."
        : overview.runningCount > 0
          ? `${overview.runningCount} running now · ${overview.completedCount} finished. Open Watch to follow live.`
          : `${campaigns.length} test${campaigns.length === 1 ? "" : "s"} on record · average score ${meanRisk ?? "—"}.`;
    if (overview.critical > 0) {
      finding += ` ${overview.critical} high-risk result${overview.critical === 1 ? "" : "s"} need a closer look.`;
    }
    const riskSpark = overview.campaignRisk
      .slice()
      .sort((a, b) => b.risk - a.risk)
      .map((c) => c.risk)
      .slice(0, 24);
    return {
      meanRisk,
      maxRisk,
      labCount,
      assessmentCount,
      failed,
      finding,
      posture: overview.posture,
      riskSpark,
    };
  }, [campaigns, overview]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = [...campaigns];
    if (filter === "running") {
      rows = rows.filter((c) => statusBucket(c.status) === "running");
    } else if (filter === "completed") {
      rows = rows.filter((c) => statusBucket(c.status) === "completed");
    } else if (filter === "failed") {
      rows = rows.filter((c) => statusBucket(c.status) === "failed");
    } else if (filter === "lab") {
      rows = rows.filter(isLabRun);
    }
    if (q) {
      rows = rows.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.provider.toLowerCase().includes(q) ||
          c.model.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q)
      );
    }

    const riskOf = (c: CampaignListItem) => riskScoreFromSummary(c.summary ?? null) ?? -1;
    const progressOf = (c: CampaignListItem) => {
      const t = Math.max(1, Number(c.total_rounds || 1));
      return Number(c.rounds_completed || 0) / t;
    };
    const rank = (s: string) => {
      const b = statusBucket(s);
      return b === "running" ? 0 : b === "failed" ? 1 : b === "completed" ? 2 : 3;
    };

    rows.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "status") {
        const d = rank(a.status) - rank(b.status);
        return d !== 0 ? d : b.name.localeCompare(a.name);
      }
      if (sort === "progress") return progressOf(b) - progressOf(a);
      // risk default
      return riskOf(b) - riskOf(a) || rank(a.status) - rank(b.status);
    });
    return rows;
  }, [campaigns, filter, query, sort]);

  if (!authLoading && !capabilities.can_run_campaigns) {
    return (
      <div className="rounded-md border border-border px-4 py-8 text-center text-[13px] text-muted-foreground">
        You don’t have permission to run safety tests. Ask an admin for access.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-xl">
          <h2 className="text-[17px] font-medium tracking-tight text-foreground">Your safety tests</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Each row is a full test against your AI. Start a quick one, or build a custom test.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => void refresh()}>
            Refresh
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/red-team/lab">Try one message</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/red-team/campaigns/new">Custom test</Link>
          </Button>
          <Button size="sm" onClick={() => setWizardOpen(true)}>
            Quick test
          </Button>
        </div>
      </div>

      <RedTeamSimpleSteps
        steps={[
          { n: 1, title: "Start a test", body: "Quick test for a short drill, or custom for more control." },
          { n: 2, title: "Watch results", body: "See what was blocked and what got through as it runs." },
          { n: 3, title: "Review", body: "Come back here anytime to reopen a finished test." },
        ]}
      />

      <RedTeamGlossary />

      {/* Cohort analytical hero */}
      <CampaignCohortHero
        model={{
          n: campaigns.length,
          running: overview.runningCount,
          completed: overview.completedCount,
          failed: cohort.failed,
          meanRisk: cohort.meanRisk,
          maxRisk: cohort.maxRisk,
          detectPct: overview.detectPct,
          critical: overview.critical,
          assessmentCount: cohort.assessmentCount,
          labCount: cohort.labCount,
          finding: cohort.finding,
          posture: cohort.posture,
          riskSpark: cohort.riskSpark,
        }}
      />

      <CampaignWatchFloor campaigns={campaigns} />

      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["all", "All"],
              ["running", "Running"],
              ["completed", "Completed"],
              ["failed", "Failed"],
              ["lab", "Lab only"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[12px] transition-colors",
                filter === id
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, provider, id…"
            className="h-8 w-full min-w-[12rem] rounded-md border border-border bg-background px-2.5 text-[12px] sm:w-56"
            aria-label="Search campaigns"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="h-8 rounded-md border border-border bg-background px-2 text-[12px]"
            aria-label="Sort campaigns"
          >
            <option value="risk">Sort: risk</option>
            <option value="status">Sort: status</option>
            <option value="progress">Sort: progress</option>
            <option value="name">Sort: name</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <section className="overflow-hidden rounded-md border border-border">
        <div className="hidden grid-cols-[minmax(0,1.5fr)_7rem_6rem_5rem_auto] gap-3 border-b border-border bg-muted/20 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground sm:grid">
          <span>Campaign</span>
          <span>Progress</span>
          <span>Status</span>
          <span>Risk</span>
          <span className="text-right">Open</span>
        </div>

        {loading && campaigns.length === 0 ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-4 py-12 text-center text-[13px] text-muted-foreground">
            {campaigns.length === 0 ? (
              <>
                No campaigns yet.{" "}
                <button
                  type="button"
                  className="text-foreground underline-offset-2 hover:underline"
                  onClick={() => setWizardOpen(true)}
                >
                  Launch a quick scan
                </button>{" "}
                or{" "}
                <Link href="/red-team/campaigns/new" className="underline-offset-2 hover:underline">
                  open the builder
                </Link>
                .
              </>
            ) : (
              "No campaigns match this filter."
            )}
          </p>
        ) : (
          <ul>
            {filtered.map((c) => (
              <CampaignRow key={c.id} campaign={c} />
            ))}
          </ul>
        )}
      </section>

      <p className="text-[12px] text-muted-foreground">
        Showing {filtered.length} of {campaigns.length}. Deep dive:{" "}
        <Link href="/red-team/matrix" className="underline-offset-2 hover:underline">
          Outcomes
        </Link>{" "}
        ·{" "}
        <Link href="/red-team/graph" className="underline-offset-2 hover:underline">
          Attack Graph
        </Link>
        .
      </p>

      <RedTeamScanWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </div>
  );
}

export default function RedTeamCampaignsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full" />}>
      <RedTeamCampaignsInner />
    </Suspense>
  );
}
