"use client";

import Link from "next/link";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Check,
  CircleAlert,
  Fingerprint,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CampaignListItem } from "@/lib/hooks/useCampaigns";
import type { ServerFinding } from "@/lib/hooks/useFindings";
import type { LiveOpsState } from "@/lib/hooks/useCommandCenterLiveOps";
import { discoveryState, type Target as RegisteredTarget } from "@/lib/targets";
import type { ProviderOption } from "@/lib/hooks/useProviders";
import { CrewAgentChainViz } from "@/components/red-team/CrewAgentChainViz";

type CampaignSummary = Pick<CampaignListItem, "id" | "name" | "status" | "rounds_completed" | "total_rounds" | "summary" | "error">;

const SEVERITY_ORDER: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

function isCampaignActive(status: string) {
  return ["RUNNING", "ACTIVE", "STARTING", "QUEUED", "PENDING"].includes(status.trim().toUpperCase());
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function finiteNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function verdictCount(summary: Record<string, unknown> | null | undefined, verdict: string): number | null {
  const counts = asRecord(summary?.results_by_verdict);
  if (!counts) return null;
  const value = Object.entries(counts).find(([key]) => key.toUpperCase() === verdict)?.[1];
  return finiteNumber(value);
}

function formatUtcTime(timestamp: string | null) {
  if (!timestamp) return "No event received";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return `${date.toISOString().slice(11, 16)} UTC`;
}

function StatusDot({ tone = "neutral" }: { tone?: "good" | "warning" | "bad" | "neutral" }) {
  return <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", {
    "bg-emerald-500": tone === "good",
    "bg-amber-500": tone === "warning",
    "bg-rose-500": tone === "bad",
    "bg-neutral-600": tone === "neutral",
  })} />;
}

function ReadinessRow({
  title,
  detail,
  complete,
}: {
  title: string;
  detail: string;
  complete: boolean;
}) {
  return (
    <li className="flex items-start gap-3 py-3">
      <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border", complete
        ? "border-emerald-800/60 bg-emerald-950/40 text-emerald-400"
        : "border-neutral-800 bg-neutral-900 text-neutral-500")}>
        {complete ? <Check className="h-3 w-3" aria-hidden /> : <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="mt-0.5 text-xs leading-5 text-neutral-400">{detail}</p>
      </div>
    </li>
  );
}

function CampaignItem({ campaign }: { campaign: CampaignSummary }) {
  const total = Math.max(0, campaign.total_rounds);
  const completed = Math.max(0, campaign.rounds_completed);
  const progress = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : null;

  return (
    <li>
      <Link
        href={`/red-team/monitor/${encodeURIComponent(campaign.id)}?follow=1`}
        className="group block rounded-lg border border-neutral-800 bg-[#121212] p-4 transition-colors hover:border-neutral-700 hover:bg-[#161616] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <StatusDot tone="good" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white group-hover:text-neutral-200">{campaign.name}</p>
              <p className="mt-1 text-xs text-neutral-400">
                {progress == null ? "Progress unavailable" : `${completed} of ${total} rounds · ${progress}%`}
              </p>
              {campaign.error ? <p className="mt-1 line-clamp-2 text-xs text-rose-400">{campaign.error}</p> : null}
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-neutral-700 bg-neutral-800/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-300">
            {campaign.status.toLowerCase()}
          </span>
        </div>
        {progress != null ? (
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-neutral-800" role="progressbar" aria-label={`${campaign.name} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
            <div className="h-full rounded-full bg-emerald-500 transition-[width]" style={{ width: `${progress}%` }} />
          </div>
        ) : null}
      </Link>
    </li>
  );
}

function FindingFollowUp({
  finding,
  campaignName,
}: {
  finding: ServerFinding;
  campaignName: string;
}) {
  const verdict = finding.verdict?.toUpperCase() ?? "UNKNOWN";
  const isSuccess = verdict === "SUCCESS";
  return (
    <li>
      <Link
        href={`/findings?finding=${encodeURIComponent(finding.id)}`}
        className="group flex items-start justify-between gap-3 rounded-xl border border-neutral-800 bg-[#121212] p-3 transition-colors hover:border-neutral-700 hover:bg-[#161616] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
      >
        <div className="flex min-w-0 items-start gap-3">
          <span className={cn("mt-0.5 rounded-md border px-1.5 py-1 text-[10px] font-semibold", isSuccess
            ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
            : "border-amber-500/30 bg-amber-500/10 text-amber-300")}>
            {verdict}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white group-hover:text-neutral-200">{finding.title}</p>
            <p className="mt-1 truncate text-xs text-neutral-400">{campaignName} · {finding.category || "Uncategorized"}</p>
          </div>
        </div>
        <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-neutral-500 group-hover:text-neutral-300" aria-hidden />
      </Link>
    </li>
  );
}

export function CommandCenterStrategicFloor({
  campaigns,
  campaignsLoading,
  findings,
  findingsLoading,
  findingsUnavailable,
  targets,
  targetsLoading,
  providers,
  providersLoading,
  apiOnline,
  liveOps,
  onRefresh,
  hideTitle = false,
}: {
  campaigns: CampaignListItem[];
  campaignsLoading: boolean;
  findings: ServerFinding[];
  findingsLoading: boolean;
  findingsUnavailable: boolean;
  targets: RegisteredTarget[];
  targetsLoading: boolean;
  providers: ProviderOption[];
  providersLoading: boolean;
  apiOnline: boolean;
  liveOps: LiveOpsState;
  onRefresh: () => void;
  hideTitle?: boolean;
}) {
  const activeCampaigns: CampaignSummary[] = campaigns
    .filter((campaign) => isCampaignActive(campaign.status))
    .map(({ id, name, status, rounds_completed, total_rounds, summary, error }) => ({ id, name, status, rounds_completed, total_rounds, summary, error }));

  const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign.name]));
  const defenseFollowUps = findings
    .filter((finding) => (
      finding.source === "campaign" &&
      ["SUCCESS", "PARTIAL"].includes(finding.verdict?.toUpperCase() ?? "") &&
      finding.status !== "promoted"
    ))
    .sort((a, b) => (
      (Number(b.verdict?.toUpperCase() === "SUCCESS") - Number(a.verdict?.toUpperCase() === "SUCCESS")) ||
      ((SEVERITY_ORDER[b.severity] ?? 0) - (SEVERITY_ORDER[a.severity] ?? 0))
    ));

  const completedCampaigns = campaigns.filter((campaign) => campaign.status.toUpperCase() === "COMPLETED");
  const authorizedTargets = targets.filter((target) => target.authorized);
  const mappedTargets = authorizedTargets.filter((target) => discoveryState(target) === "mapped");
  const readyTargets = mappedTargets.filter((target) =>
    providers.some((provider) => provider.id === target.provider && provider.configured)
  );
  const firstUnapprovedTarget = targets.find((target) => !target.authorized);
  const firstUnmappedTarget = authorizedTargets.find((target) => discoveryState(target) !== "mapped");
  const mappedTargetWithoutProvider = mappedTargets.find((target) =>
    !providers.some((provider) => provider.id === target.provider && provider.configured)
  );
  const live = liveOps.telemetryMode === "LIVE" && Boolean(liveOps.events.length || activeCampaigns.length);
  const failedHandoffs = liveOps.events.filter((event) => event.hmac.signatureStatus === "failed").length;
  const verifiedHandoffs = liveOps.events.filter((event) => event.hmac.signatureStatus === "verified").length;

  const readiness = !apiOnline
    ? { title: "Restore the API connection", detail: "Campaign and target data may be out of date until the backend is healthy.", href: "/admin/system", action: "System health" }
    : targetsLoading
      ? { title: "Checking target readiness", detail: "Loading registered targets.", href: undefined, action: undefined }
      : providersLoading
        ? { title: "Checking provider readiness", detail: "Loading tenant providers and environment fallback status.", href: undefined, action: undefined }
      : targets.length === 0
        ? { title: "Register an authorized target", detail: "Add the AI system you have permission to assess before starting a campaign.", href: "/targets", action: "Add target" }
        : firstUnapprovedTarget
          ? { title: `Authorize ${firstUnapprovedTarget.name}`, detail: "ARTSA requires explicit authorization before it sends assessment traffic.", href: "/targets", action: "Review target" }
          : firstUnmappedTarget
            ? { title: `Map ${firstUnmappedTarget.name}`, detail: "Run discovery to record its reachable attack surface.", href: "/targets", action: "Run discovery" }
            : mappedTargetWithoutProvider
              ? { title: `Configure ${mappedTargetWithoutProvider.provider || "a"} provider`, detail: `The mapped target “${mappedTargetWithoutProvider.name}” has no usable tenant provider credential.`, href: "/settings/integrations", action: "Configure provider" }
              : { title: "Choose a campaign focus", detail: `${readyTargets.length} authorized target${readyTargets.length === 1 ? " is" : "s are"} mapped and provider-ready.`, href: "/red-team/campaigns/new", action: "Start assessment" };

  const recentCompleted = completedCampaigns.slice(0, 3);
  const assessmentReady = apiOnline && !targetsLoading && !providersLoading && readyTargets.length > 0;
  const followUpCount = findingsUnavailable ? "—" : findingsLoading ? "…" : String(defenseFollowUps.length);

  return (
    <main className={cn("min-h-full text-white", !hideTitle && "bg-[#070707]")}>
      <div className={cn("mx-auto w-full max-w-[1600px]", !hideTitle ? "px-4 py-6 sm:px-6 lg:px-10 lg:py-9" : "px-0 py-2")}>
        {!hideTitle && (
          <header className="flex flex-col gap-6 border-b border-neutral-800 pb-7 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
                ARTSA <span className="text-neutral-600">/</span> Security operations
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
                Command Center
              </h1>
              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-neutral-400">
                Live assessments, defense reviews, and runtime health in one place.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("inline-flex h-10 items-center gap-2 rounded-full border px-3 text-xs font-medium", apiOnline
                ? "border-emerald-800/60 bg-emerald-950/40 text-emerald-400"
                : "border-rose-800/60 bg-rose-950/40 text-rose-400")}>
                <StatusDot tone={apiOnline ? "good" : "bad"} />API {apiOnline ? "connected" : "offline"}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-neutral-400 hover:bg-neutral-800 hover:text-white"
                onClick={onRefresh}
                aria-label="Refresh Command Center data"
              >
                <RefreshCw className="h-4 w-4" aria-hidden />
              </Button>
              <Button asChild variant="outline" className="h-10 gap-2 border-neutral-800 bg-[#0e0e0e] text-neutral-200 hover:bg-neutral-800 hover:text-white">
                <Link href="/red-team/monitor">
                  <CircleAlert className="h-4 w-4" aria-hidden />Detections<ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </Button>
            </div>
          </header>
        )}

        <section aria-label="Operations snapshot" className="mt-4 grid grid-cols-2 border-b border-neutral-800 pb-4 md:grid-cols-4">
          <div className="border-r border-neutral-800 px-3 py-1 first:pl-0 sm:px-5">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-400">Active assessments</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{campaignsLoading ? "…" : activeCampaigns.length}</p>
            <p className="mt-1 text-xs text-neutral-500">Campaigns in progress</p>
          </div>
          <div className="border-neutral-800 px-3 py-1 md:border-r sm:px-5">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-400">Authorized targets</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{targetsLoading ? "…" : authorizedTargets.length}</p>
            <p className="mt-1 text-xs text-neutral-500">{targetsLoading ? "Checking targets" : `${mappedTargets.length} mapped · ${targets.length} registered`}</p>
          </div>
          <div className="border-r border-t border-neutral-800 px-3 py-3 md:border-t-0 md:border-r sm:px-5 md:py-1">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-400">Defense reviews</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{followUpCount}</p>
            <p className="mt-1 text-xs text-neutral-500">Outcomes awaiting policy review</p>
          </div>
          <div className="border-t border-neutral-800 px-3 py-3 md:border-t-0 sm:px-5 md:py-1">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-400">Campaign history</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{campaignsLoading ? "…" : completedCampaigns.length}</p>
            <p className="mt-1 text-xs text-neutral-500">Completed assessments</p>
          </div>
        </section>

        <section className="mt-5 grid items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <article aria-labelledby="running-title" className="overflow-hidden rounded-xl border border-neutral-800 bg-[#0e0e0e] shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800 px-5 py-4 sm:px-6">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-300">
                  <Workflow className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">Assessment workspace</p>
                  <h2 id="running-title" className="mt-0.5 text-lg font-semibold text-white">Campaigns</h2>
                </div>
              </div>
              <Link href="/red-team/campaigns" className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-300 transition hover:text-white">
                All campaigns<ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>

            {campaignsLoading && activeCampaigns.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-neutral-400" role="status">Loading assessment records…</div>
            ) : activeCampaigns.length > 0 ? (
              <ul className="grid gap-2 p-4 sm:p-5">{activeCampaigns.slice(0, 4).map((campaign) => <CampaignItem key={campaign.id} campaign={campaign} />)}</ul>
            ) : (
              <div className="p-5 sm:p-6">
                <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-800/60 bg-amber-950/40 text-amber-400">
                      <CircleAlert className="h-4 w-4" aria-hidden />
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-white">{readiness.title}</h3>
                        <span className="rounded-full border border-neutral-700 bg-neutral-800/80 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-neutral-400">Idle</span>
                      </div>
                      <p className="mt-1 max-w-xl text-sm leading-6 text-neutral-400">{readiness.detail}</p>
                    </div>
                  </div>
                  {readiness.href && readiness.action ? (
                    <Button asChild className="h-10 shrink-0 gap-2 bg-white px-4 font-semibold text-black hover:bg-neutral-200">
                      <Link href={readiness.href}>{readiness.action}<ArrowRight className="h-4 w-4" aria-hidden /></Link>
                    </Button>
                  ) : <Button type="button" disabled className="h-10 shrink-0 bg-neutral-800 px-4 text-neutral-500">Checking readiness…</Button>}
                </div>
                <ol aria-label="Assessment readiness steps" className="mt-6 grid gap-3 border-t border-neutral-800 pt-5 sm:grid-cols-2 xl:grid-cols-5">
                  <ReadinessRow title="API connection" detail={apiOnline ? "Endpoints reachable" : "Backend needs attention"} complete={apiOnline} />
                  <ReadinessRow title="Target authorization" detail={targetsLoading ? "Loading targets" : authorizedTargets.length > 0 ? `${authorizedTargets.length} authorized` : targets.length > 0 ? "Authorization required" : "No targets registered"} complete={!targetsLoading && authorizedTargets.length > 0} />
                  <ReadinessRow title="Surface discovery" detail={targetsLoading ? "Waiting for targets" : mappedTargets.length > 0 ? `${mappedTargets.length} mapped` : authorizedTargets.length > 0 ? "Discovery required" : "Waiting for authorization"} complete={!targetsLoading && mappedTargets.length > 0} />
                  <ReadinessRow title="Provider credential" detail={providersLoading ? "Checking providers" : readyTargets.length > 0 ? `${readyTargets.length} target${readyTargets.length === 1 ? "" : "s"} provider-ready` : "Configure target provider"} complete={!providersLoading && readyTargets.length > 0} />
                  <ReadinessRow title="Campaign focus" detail={activeCampaigns.length > 0 ? "Campaign in progress" : assessmentReady ? "Ready to choose" : "Waiting for readiness"} complete={activeCampaigns.length > 0} />
                </ol>
              </div>
            )}
            {activeCampaigns.length > 4 ? <p className="mt-3 px-5 pb-4 text-xs text-neutral-500">Showing 4 of {activeCampaigns.length} running assessments.</p> : null}
          </article>

          <article aria-labelledby="follow-up-title" className="rounded-2xl border border-neutral-800 bg-[#0e0e0e] p-5 shadow-sm sm:p-6">
            <div className="flex items-start justify-between gap-3 border-b border-neutral-800 pb-4">
              <div>
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">Evidence desk</p>
                <h2 id="follow-up-title" className="mt-1 text-lg font-semibold text-white">Defense follow-up</h2>
                <p className="mt-1 text-xs leading-5 text-neutral-400">Campaign outcomes that need a policy review.</p>
              </div>
              <span className="rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 font-mono text-sm tabular-nums text-neutral-200">{followUpCount}</span>
            </div>
            {findingsLoading ? (
              <div className="mt-5 rounded-xl border border-dashed border-neutral-800 px-4 py-8 text-center text-sm text-neutral-400" role="status">Loading campaign outcomes…</div>
            ) : findingsUnavailable ? (
              <div className="mt-5 rounded-xl border border-amber-800/40 bg-amber-950/20 px-4 py-5">
                <p className="text-sm font-medium text-amber-300">Review queue unavailable</p>
                <p className="mt-1 text-xs leading-5 text-neutral-400">The findings endpoint did not return data. Check the API before treating this queue as clear.</p>
              </div>
            ) : defenseFollowUps.length > 0 ? (
              <>
                <p className="mt-4 text-xs text-neutral-400"><span className="font-semibold tabular-nums text-white">{defenseFollowUps.length}</span> proven outcome{defenseFollowUps.length === 1 ? "" : "s"} awaiting review</p>
                <ul className="mt-3 space-y-2">{defenseFollowUps.slice(0, 4).map((finding) => <FindingFollowUp key={finding.id} finding={finding} campaignName={campaignById.get(finding.source_ref ?? "") ?? "Campaign result"} />)}</ul>
                {defenseFollowUps.length > 4 ? <Link href="/findings" className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-neutral-300 hover:text-white">Review all {defenseFollowUps.length}<ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link> : null}
              </>
            ) : (
              <div className="mt-5 rounded-xl border border-neutral-800 bg-[#121212] p-4">
                <div className="flex items-center gap-2 text-emerald-400"><Check className="h-4 w-4" aria-hidden /><p className="text-sm font-medium">Nothing waiting for review</p></div>
                <p className="mt-2 text-xs leading-5 text-neutral-400">No unpromoted SUCCESS or PARTIAL campaign outcomes were returned. This does not mean every defense is secure.</p>
                <Link href="/findings" className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-neutral-300 hover:text-white">Open findings<ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link>
              </div>
            )}
          </article>
        </section>

        <section className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(330px,0.75fr)]">
          <article aria-labelledby="history-title" className="rounded-2xl border border-neutral-800 bg-[#0e0e0e] p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-neutral-800 pb-4">
              <div>
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">Assessment record</p>
                <h2 id="history-title" className="mt-1 text-lg font-semibold text-white">Recent completed runs</h2>
              </div>
              <Link href="/red-team/campaigns" className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-300 hover:text-white">All campaigns<ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link>
            </div>
            {campaignsLoading && recentCompleted.length === 0 ? (
              <p className="py-8 text-center text-sm text-neutral-400" role="status">Loading campaign history…</p>
            ) : recentCompleted.length > 0 ? (
              <ul className="divide-y divide-neutral-800">
                {recentCompleted.map((campaign) => {
                  const summary = asRecord(campaign.summary);
                  const successes = verdictCount(summary, "SUCCESS");
                  const partials = verdictCount(summary, "PARTIAL");
                  const blocked = verdictCount(summary, "BLOCKED");
                  return (
                    <li key={campaign.id}>
                      <Link href={`/red-team/monitor/${encodeURIComponent(campaign.id)}?follow=0`} className="group grid gap-3 py-4 transition hover:bg-neutral-900/50 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-400">
                            <ShieldCheck className="h-4 w-4" aria-hidden />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-white group-hover:text-neutral-200">{campaign.name}</p>
                            <p className="mt-1 text-xs text-neutral-400">{campaign.rounds_completed} of {campaign.total_rounds} rounds completed</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 pl-11 font-mono text-[10px] tabular-nums sm:pl-0">
                          <span className="text-rose-400">SUCCESS {successes ?? "—"}</span>
                          <span className="text-amber-400">PARTIAL {partials ?? "—"}</span>
                          <span className="text-emerald-400">BLOCKED {blocked ?? "—"}</span>
                          <ArrowUpRight className="h-3.5 w-3.5 text-neutral-500 group-hover:text-neutral-300" aria-hidden />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="py-5 text-center">
                <p className="text-sm font-medium text-white">No completed assessment yet</p>
                <p className="mt-1 text-xs text-neutral-400">Judge outcomes will appear here when a campaign finishes.</p>
              </div>
            )}
          </article>

          <article aria-labelledby="system-status-title" className="rounded-2xl border border-neutral-800 bg-[#0e0e0e] p-5 shadow-sm sm:p-6">
            <div className="flex items-start justify-between gap-3 border-b border-neutral-800 pb-4">
              <div>
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">Runtime assurance</p>
                <h2 id="system-status-title" className="mt-1 text-lg font-semibold text-white">Operational signals</h2>
              </div>
              <Link href="/admin/system" className="pt-1 text-xs font-medium text-neutral-300 hover:text-white">
                System health<ArrowUpRight className="ml-1 inline h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
            <p className="mt-3 text-xs leading-5 text-neutral-400">Telemetry is labeled live only when a campaign or event is reported by the API.</p>
            <div className="mt-4 space-y-0 divide-y divide-neutral-800">
              <div className="flex items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-2.5">
                  <StatusDot tone={live ? "good" : liveOps.telemetryMode === "STALE" ? "warning" : "neutral"} />
                  <span className="text-xs text-neutral-400">Run telemetry</span>
                </div>
                <span className="text-xs font-medium text-white">{live ? "Live" : liveOps.telemetryMode === "STALE" ? "Stale" : "Waiting"}</span>
              </div>
              <div className="flex items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-2.5">
                  <Fingerprint className="h-3.5 w-3.5 text-neutral-500" aria-hidden />
                  <span className="text-xs text-neutral-400">HMAC handoffs</span>
                </div>
                <span className="text-right text-xs font-medium text-white">
                  {live ? failedHandoffs > 0 ? `${failedHandoffs} failed` : verifiedHandoffs > 0 ? `${verifiedHandoffs} verified` : "No checks observed" : "No live checks"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-2.5">
                  <Activity className="h-3.5 w-3.5 text-neutral-500" aria-hidden />
                  <span className="text-xs text-neutral-400">WebSocket</span>
                </div>
                <span className="text-xs font-medium text-white">{liveOps.connection.connected ? "Connected" : "Disconnected"}</span>
              </div>
            </div>
            <p className="mt-1 border-t border-neutral-800 pt-3 text-[10px] text-neutral-500">
              Last event: {formatUtcTime(liveOps.connection.lastEventAt)} <span className="px-1 text-neutral-700">·</span> reconnects {liveOps.connection.reconnectCount}
            </p>
          </article>
        </section>

        {/* Agent & MCP Tool Blast Radius Shelf (OWASP ASI08) */}
        <section aria-labelledby="agent-blast-title" className="mt-5 rounded-2xl border border-neutral-800 bg-[#0e0e0e] p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 text-white">
                <ShieldAlert className="h-4 w-4 text-emerald-400" />
              </span>
              <div>
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
                  Agentic Governance &amp; Runtime Boundaries
                </p>
                <h2 id="agent-blast-title" className="mt-0.5 text-lg font-semibold text-white">
                  Agent Blast Radius &amp; Circuit Breakers (ASI08)
                </h2>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-emerald-800/60 bg-emerald-950/40 px-2.5 py-0.5 font-mono text-[10px] font-bold text-emerald-400">
                Breaker Threshold: 3 blocks / 60s
              </span>
              <Button asChild variant="outline" size="sm" className="h-7 text-xs border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800 hover:text-white">
                <Link href="/admin/policies">Review Gating Rules</Link>
              </Button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 font-mono text-xs">
            <div className="rounded-xl border border-neutral-800 bg-[#121212] p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">agent-customer-support</span>
                <span className="rounded border border-emerald-800/60 bg-emerald-950/60 text-emerald-400 px-1.5 py-0.5 text-[9.5px] font-bold">ARMED</span>
              </div>
              <p className="text-[11px] text-neutral-400 font-sans">Authorized Tools: <code className="font-mono text-[10px] bg-neutral-900 px-1 py-0.5 rounded border border-neutral-800 text-neutral-300">chat</code></p>
              <div className="text-[10px] text-neutral-400 border-t border-neutral-800 pt-1.5 flex justify-between">
                <span>Egress Fence:</span>
                <span className="font-bold text-neutral-200">Restricted Buffer</span>
              </div>
            </div>

            <div className="rounded-xl border border-neutral-800 bg-[#121212] p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">agent-ops-worker</span>
                <span className="rounded border border-emerald-800/60 bg-emerald-950/60 text-emerald-400 px-1.5 py-0.5 text-[9.5px] font-bold">CONTAINED</span>
              </div>
              <p className="text-[11px] text-neutral-400 font-sans">Authorized Tools: <code className="font-mono text-[10px] bg-neutral-900 px-1 py-0.5 rounded border border-neutral-800 text-neutral-300">read_file, web_fetch</code></p>
              <div className="text-[10px] text-neutral-400 border-t border-neutral-800 pt-1.5 flex justify-between">
                <span>SSRF Gate:</span>
                <span className="font-bold text-rose-400">169.254.0.0/16 Blocked</span>
              </div>
            </div>

            <div className="rounded-xl border border-neutral-800 bg-[#121212] p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">agent-data-analytics</span>
                <span className="rounded border border-emerald-800/60 bg-emerald-950/60 text-emerald-400 px-1.5 py-0.5 text-[9.5px] font-bold">ARMED</span>
              </div>
              <p className="text-[11px] text-neutral-400 font-sans">Authorized Tools: <code className="font-mono text-[10px] bg-neutral-900 px-1 py-0.5 rounded border border-neutral-800 text-neutral-300">query_database</code></p>
              <div className="text-[10px] text-neutral-400 border-t border-neutral-800 pt-1.5 flex justify-between">
                <span>SQL Scope:</span>
                <span className="font-bold text-neutral-200">Read-Only Analytics</span>
              </div>
            </div>

            <div className="rounded-xl border border-neutral-800 bg-[#121212] p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">agent-workflow-coordinator</span>
                <span className="rounded border border-emerald-800/60 bg-emerald-950/60 text-emerald-400 px-1.5 py-0.5 text-[9.5px] font-bold">HEALTHY</span>
              </div>
              <p className="text-[11px] text-neutral-400 font-sans">Max Recursion Depth: <code className="font-mono text-[10px] bg-neutral-900 px-1 py-0.5 rounded border border-neutral-800 text-neutral-300">3 levels</code></p>
              <div className="text-[10px] text-neutral-400 border-t border-neutral-800 pt-1.5 flex justify-between">
                <span>Trip Status:</span>
                <span className="font-bold text-emerald-400">0 / 3 Tripped</span>
              </div>
            </div>
          </div>
        </section>

        {/* Platform Architecture: Six-Agent Chain & HMAC Provenance */}
        <section aria-labelledby="architecture-title" className="mt-5 rounded-2xl border border-neutral-800 bg-[#0e0e0e] p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-300">
                <Fingerprint className="h-4 w-4 text-emerald-400" aria-hidden />
              </span>
              <div>
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
                  Platform Architecture &amp; Cryptographic Traceability
                </p>
                <h2 id="architecture-title" className="mt-0.5 text-lg font-semibold text-white">
                  Six-Agent Chain &amp; HMAC Handoff Verification
                </h2>
              </div>
            </div>
            <Link
              href="/red-team/coverage"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-300 hover:text-white transition-colors"
            >
              Review agentic coverage
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
          <p className="mt-3 text-xs leading-5 text-neutral-400">
            Canonical execution sequence: <span className="font-mono text-neutral-200">Research → Curator → Red Team → Target → Judge → Defender</span>. Every inter-agent message is cryptographically signed and verified via HMAC-SHA256 to guarantee immutable telemetry provenance.
          </p>
          <div className="mt-5">
            <CrewAgentChainViz />
          </div>
        </section>

        {liveOps.error ? <p role="status" className="mt-4 rounded-lg border border-amber-800/40 bg-amber-950/20 px-4 py-3 text-sm text-amber-300">Telemetry could not refresh: {liveOps.error}</p> : null}
      </div>
    </main>
  );
}
