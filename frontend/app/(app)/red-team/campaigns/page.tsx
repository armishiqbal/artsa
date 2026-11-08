"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Sparkles, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CampaignCohortHero } from "@/components/red-team/CampaignCohortHero";
import { CampaignWatchFloor } from "@/components/red-team/CampaignWatchFloor";
import { CrewAgentChainViz } from "@/components/red-team/CrewAgentChainViz";
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
import { DEMO_REDTEAM_CAMPAIGNS } from "@/lib/redTeamDemoData";
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
    <li className="border-b border-neutral-800 last:border-0 hover:bg-neutral-900/40 transition-colors">
      <div className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1.5fr)_7rem_6rem_5rem_auto] sm:items-center">
        <Link href={`/red-team/monitor/${campaign.id}`} className="min-w-0 group">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                bucket === "running" && "animate-pulse bg-emerald-400",
                bucket === "completed" && "bg-emerald-500",
                bucket === "failed" && "bg-rose-500",
                bucket === "other" && "bg-neutral-600"
              )}
              aria-hidden
            />
            <span className="truncate text-sm font-medium text-white group-hover:text-neutral-200">
              {campaign.name}
            </span>
            {isLabRun(campaign) ? (
              <span className="shrink-0 rounded border border-neutral-700 bg-neutral-800 px-1.5 py-0.2 font-mono text-[9px] uppercase tracking-wider text-neutral-300">
                lab
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate font-mono text-[11px] text-neutral-400">
            {campaign.provider}/{campaign.model}
            {campaign.error ? ` · ${String(campaign.error).slice(0, 48)}` : ""}
          </p>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-neutral-800 sm:hidden">
            <div
              className={cn(
                "h-full rounded-full",
                bucket === "failed" ? "bg-rose-500" : "bg-emerald-500"
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </Link>

        <div className="hidden sm:block">
          <p className="font-mono text-[11px] tabular-nums text-neutral-400">
            {done}/{campaign.total_rounds} · {pct}%
          </p>
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-neutral-800">
            <div
              className={cn(
                "h-full rounded-full",
                bucket === "failed"
                  ? "bg-rose-500"
                  : bucket === "running"
                  ? "bg-emerald-400"
                  : "bg-emerald-500"
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <span
          className={cn(
            "font-mono text-xs font-semibold uppercase tracking-wider",
            bucket === "failed" && "text-rose-400",
            bucket === "running" && "text-emerald-400",
            bucket === "completed" && "text-neutral-300",
            bucket === "other" && "text-neutral-500"
          )}
        >
          {friendlyStatus(campaign.status)}
        </span>

        <span
          className={cn(
            "tabular-nums text-sm font-mono font-bold",
            risk != null && risk >= 80 ? "text-rose-400" : "text-white"
          )}
        >
          {risk != null ? `${risk}/100` : "—"}
        </span>

        <div className="flex flex-wrap gap-1.5 sm:justify-end">
          <Button
            size="sm"
            variant="outline"
            className="h-7 border-neutral-800 bg-neutral-900 px-2.5 font-mono text-[11px] font-semibold text-neutral-200 hover:bg-neutral-800 hover:text-white shadow-2xs"
            asChild
          >
            <Link href={`/red-team/monitor/${campaign.id}?follow=1`}>
              {bucket === "running" ? "Watch live" : "Open run"}
            </Link>
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
  const [datasetMode, setDatasetMode] = useState<"demo" | "live">("demo");

  useEffect(() => {
    if (searchParams.get("new") === "1") setWizardOpen(true);
  }, [searchParams]);

  const effectiveCampaigns = useMemo(() => {
    if (datasetMode === "demo") return DEMO_REDTEAM_CAMPAIGNS;
    return campaigns;
  }, [datasetMode, campaigns]);

  const overview = useMemo(() => deriveRedTeamOverview(effectiveCampaigns), [effectiveCampaigns]);

  const cohort = useMemo(() => {
    const risks = overview.campaignRisk.map((c) => c.risk).filter((r) => r > 0);
    const meanRisk =
      risks.length > 0
        ? Math.round((risks.reduce((a, b) => a + b, 0) / risks.length) * 10) / 10
        : null;
    const maxRisk = risks.length > 0 ? Math.max(...risks) : 0;
    const labCount = effectiveCampaigns.filter(isLabRun).length;
    const assessmentCount = effectiveCampaigns.length - labCount;
    const failed = effectiveCampaigns.filter((c) => statusBucket(c.status) === "failed").length;
    let finding =
      effectiveCampaigns.length === 0
        ? "No campaigns yet. Launch a quick scan or open the builder."
        : overview.runningCount > 0
          ? `${overview.runningCount} running · ${overview.completedCount} complete. Watch live to follow rounds.`
          : `${effectiveCampaigns.length} campaign${effectiveCampaigns.length === 1 ? "" : "s"} · mean risk ${meanRisk ?? "—"}.`;
    if (overview.critical > 0) {
      finding += ` ${overview.critical} critical result${overview.critical === 1 ? "" : "s"} need review.`;
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
  }, [effectiveCampaigns, overview]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = [...effectiveCampaigns];
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

    // Ongoing live always surfaces first — risk is often null while a run is mid-flight.
    rows.sort((a, b) => {
      const liveFirst = rank(a.status) - rank(b.status);
      if (liveFirst !== 0) return liveFirst;
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "status") return a.name.localeCompare(b.name);
      if (sort === "progress") return progressOf(b) - progressOf(a);
      return riskOf(b) - riskOf(a) || a.name.localeCompare(b.name);
    });
    return rows;
  }, [effectiveCampaigns, filter, query, sort]);

  const ongoing = useMemo(
    () => effectiveCampaigns.filter((c) => statusBucket(c.status) === "running"),
    [effectiveCampaigns]
  );

  // When a run first appears, switch to Running so ongoing live is obvious.
  const [autoFocusedLive, setAutoFocusedLive] = useState(false);
  useEffect(() => {
    if (ongoing.length > 0 && !autoFocusedLive) {
      setFilter("running");
      setAutoFocusedLive(true);
    }
    if (ongoing.length === 0) setAutoFocusedLive(false);
  }, [ongoing.length, autoFocusedLive]);

  if (!authLoading && !capabilities.can_run_campaigns) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-[#0e0e0e] px-4 py-8 text-center text-[13px] text-neutral-400">
        You don’t have permission to run campaigns. Ask an admin for access.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pre-Flight Multi-Agent Guidance Banner */}
      {datasetMode === "demo" ? (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-neutral-800 bg-[#0e0e0e] p-3.5 shadow-2xs">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-black shadow-xs">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-white">
                  Pre-Flight Multi-Agent Simulation · Labeled Demonstration Suite
                </span>
                <span className="rounded bg-neutral-800 border border-neutral-700 px-1.5 py-0.2 font-mono text-[10px] font-bold text-neutral-200">
                  CrewAI 6-Agent Chain
                </span>
              </div>
              <p className="mt-0.5 text-xs text-neutral-400 leading-relaxed font-sans">
                {campaigns.length === 0
                  ? "Zero live campaigns recorded in the operational database. Displaying 3 pre-flight multi-agent simulations across OWASP ASI01, ASI02, and ASI04 with HMAC-signed handoffs."
                  : "Reviewing pre-flight multi-agent simulation scenarios. Switch to Live Telemetry to inspect active operational runs."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <Button asChild size="sm" className="h-7 bg-white hover:bg-neutral-200 text-black font-semibold font-mono text-xs gap-1.5 shadow-xs">
              <Link href="/red-team/campaigns/new">
                Launch Live Campaign
              </Link>
            </Button>
          </div>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-neutral-800 bg-[#0e0e0e] p-3.5 shadow-2xs">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-neutral-700 bg-neutral-900 text-white shadow-xs">
              <Radio className="h-4 w-4" />
            </div>
            <div>
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-white">
                Live Operations Telemetry · No Campaigns Recorded
              </span>
              <p className="mt-0.5 text-xs text-neutral-400 font-sans">
                No active or completed live campaign sessions recorded in backend telemetry. Switch to Simulation Suite to inspect the multi-agent chain.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setDatasetMode("demo")}
            className="h-7 bg-white hover:bg-neutral-200 text-black font-semibold font-mono text-xs gap-1.5 shadow-xs shrink-0 self-end sm:self-center"
          >
            <Sparkles className="h-3 w-3" />
            Switch to Simulation Suite
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-xl">
          <h2 className="text-xl font-bold tracking-tight text-white">Campaign War Room</h2>
          <p className="mt-1 text-xs text-neutral-400">
            {datasetMode === "demo"
              ? "Autonomous 6-agent offensive simulations with HMAC custody passing across adversarial rounds."
              : "Live list from ARTSA operational database. Updates as runs finish or fail."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Dataset Switcher: Simulation Suite vs Live Telemetry */}
          <div className="flex items-center rounded-lg border border-neutral-800 bg-[#0e0e0e] p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setDatasetMode("demo")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-xs font-semibold transition-colors",
                datasetMode === "demo"
                  ? "bg-white text-black font-bold shadow-2xs"
                  : "text-neutral-400 hover:text-white hover:bg-neutral-800"
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Simulation Suite ({DEMO_REDTEAM_CAMPAIGNS.length})
            </button>
            <button
              type="button"
              onClick={() => setDatasetMode("live")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-xs font-semibold transition-colors",
                datasetMode === "live"
                  ? "bg-white text-black font-bold shadow-2xs"
                  : "text-neutral-400 hover:text-white hover:bg-neutral-800"
              )}
            >
              <Radio className="h-3 w-3" />
              Live Telemetry ({campaigns.length})
            </button>
          </div>

          <Button
            size="sm"
            variant="outline"
            className="border-neutral-800 bg-[#0e0e0e] text-neutral-200 hover:bg-neutral-800 hover:text-white"
            onClick={() => void refresh()}
          >
            Refresh
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-neutral-800 bg-[#0e0e0e] text-neutral-200 hover:bg-neutral-800 hover:text-white"
            asChild
          >
            <Link href="/red-team/lab">Attack Lab</Link>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-neutral-800 bg-[#0e0e0e] text-neutral-200 hover:bg-neutral-800 hover:text-white"
            asChild
          >
            <Link href="/red-team/campaigns/new">Builder</Link>
          </Button>
          <Button
            size="sm"
            className="bg-white text-black font-semibold hover:bg-neutral-200"
            onClick={() => setWizardOpen(true)}
          >
            Quick scan
          </Button>
        </div>
      </div>

      {/* Autonomous Multi-Agent Crew Pipeline (Six-Agent Chain) */}
      <CrewAgentChainViz />

      {ongoing.length === 0 ? (
        <div className="rounded-xl border border-neutral-800 bg-[#0e0e0e] px-4 py-3.5 text-xs">
          <p className="font-semibold text-white">No ongoing live runs</p>
          <p className="mt-1 text-neutral-400">
            Orbit and table below represent past assessment history. Start a run — it will surface at the top here, on Detections, and in Command Center.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" className="bg-white text-black font-semibold hover:bg-neutral-200" asChild>
              <Link href="/red-team/lab">Start Attack Lab</Link>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-neutral-800 bg-neutral-900 text-neutral-200 hover:bg-neutral-800 hover:text-white"
              onClick={() => setWizardOpen(true)}
            >
              Quick scan
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-neutral-800 bg-neutral-900 text-neutral-200 hover:bg-neutral-800 hover:text-white"
              asChild
            >
              <Link href="/red-team/monitor">Open Detections</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-800/60 bg-emerald-950/40 px-4 py-3.5 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-emerald-400 font-mono">
              Ongoing live · {ongoing.length} run{ongoing.length === 1 ? "" : "s"} · auto-refreshing
            </p>
            <Button size="sm" variant="outline" className="h-7 text-xs border-emerald-800/60 text-emerald-300 hover:bg-emerald-900/40" asChild>
              <Link href="/red-team/monitor">All on Detections</Link>
            </Button>
          </div>
          <ul className="mt-3 space-y-2">
            {ongoing.map((c) => {
              const done = Number(c.rounds_completed || 0);
              return (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-800/40 bg-[#0e0e0e]/90 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">{c.name}</p>
                    <p className="font-mono text-[11px] text-neutral-400">
                      {done}/{c.total_rounds} rounds · {c.provider}/{c.model}
                    </p>
                  </div>
                  <Button size="sm" className="h-7 shrink-0 text-xs bg-white text-black font-semibold hover:bg-neutral-200" asChild>
                    <Link href={`/red-team/monitor/${c.id}?follow=1`}>Watch live</Link>
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <RedTeamSimpleSteps
        steps={[
          { n: 1, title: "Launch", body: "Quick scan for a short run, or builder for more control." },
          { n: 2, title: "Watch", body: "While a run is live, open Detections for that campaign." },
          { n: 3, title: "Review", body: "Reopen finished campaigns anytime from this list." },
        ]}
      />

      <RedTeamGlossary />

      {/* Cohort analytical hero */}
      <CampaignCohortHero
        model={{
          n: effectiveCampaigns.length,
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

      <CampaignWatchFloor campaigns={effectiveCampaigns} />

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
                "rounded-md px-3 py-1 font-mono text-xs font-semibold transition-colors",
                filter === id
                  ? "bg-white text-black font-bold shadow-2xs"
                  : "bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800"
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
            className="h-8 w-full min-w-[12rem] rounded-md border border-neutral-800 bg-neutral-900 px-2.5 text-xs text-white placeholder:text-neutral-500 sm:w-56"
            aria-label="Search campaigns"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="h-8 rounded-md border border-neutral-800 bg-neutral-900 px-2 font-mono text-xs text-neutral-200"
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
      <section className="overflow-hidden rounded-xl border border-neutral-800 bg-[#0e0e0e] shadow-2xs">
        <div className="hidden grid-cols-[minmax(0,1.5fr)_7rem_6rem_5rem_auto] gap-3 border-b border-neutral-800 bg-[#121212] px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-neutral-400 sm:grid">
          <span>Campaign</span>
          <span>Progress</span>
          <span>Status</span>
          <span>Risk</span>
          <span className="text-right">Open</span>
        </div>

        {loading && effectiveCampaigns.length === 0 ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full bg-neutral-900" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-4 py-12 text-center text-xs text-neutral-400 font-mono">
            {effectiveCampaigns.length === 0 ? (
              <>
                No campaigns yet.{" "}
                <button
                  type="button"
                  className="text-white underline underline-offset-2 hover:text-neutral-200"
                  onClick={() => setWizardOpen(true)}
                >
                  Launch a quick scan
                </button>{" "}
                or{" "}
                <Link href="/red-team/campaigns/new" className="text-white underline underline-offset-2 hover:text-neutral-200">
                  open the builder
                </Link>
                .
              </>
            ) : (
              "No campaigns match this filter."
            )}
          </p>
        ) : (
          <ul className="divide-y divide-neutral-800/80">
            {filtered.map((c) => (
              <CampaignRow key={c.id} campaign={c} />
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-neutral-400 font-mono">
        Showing {filtered.length} of {effectiveCampaigns.length}. Deep dive:{" "}
        <Link href="/red-team/matrix" className="text-white underline underline-offset-2 hover:text-neutral-200">
          Outcomes
        </Link>{" "}
        ·{" "}
        <Link href="/red-team/graph" className="text-white underline underline-offset-2 hover:text-neutral-200">
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
    <Suspense fallback={<Skeleton className="h-40 w-full bg-neutral-900" />}>
      <RedTeamCampaignsInner />
    </Suspense>
  );
}
