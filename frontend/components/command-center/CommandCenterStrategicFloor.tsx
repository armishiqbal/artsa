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
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SIX_AGENTS } from "@/lib/commandCenterOps";
import type { CampaignListItem } from "@/lib/hooks/useCampaigns";
import type { ServerFinding } from "@/lib/hooks/useFindings";
import type { LiveOpsState } from "@/lib/hooks/useCommandCenterLiveOps";
import { discoveryState, type Target as RegisteredTarget } from "@/lib/targets";
import type { ProviderOption } from "@/lib/hooks/useProviders";

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
    "bg-muted-foreground/50": tone === "neutral",
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
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-slate-200 bg-white text-slate-400")}>
        {complete ? <Check className="h-3 w-3" aria-hidden /> : <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900">{title}</p>
        <p className="mt-0.5 text-xs leading-5 text-slate-500">{detail}</p>
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
        className="group block rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-sky-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <StatusDot tone="good" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900 group-hover:text-sky-800">{campaign.name}</p>
              <p className="mt-1 text-xs text-slate-500">
                {progress == null ? "Progress unavailable" : `${completed} of ${total} rounds · ${progress}%`}
              </p>
              {campaign.error ? <p className="mt-1 line-clamp-2 text-xs text-rose-700">{campaign.error}</p> : null}
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-sky-800">
            {campaign.status.toLowerCase()}
          </span>
        </div>
        {progress != null ? (
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={`${campaign.name} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
            <div className="h-full rounded-full bg-sky-600 transition-[width]" style={{ width: `${progress}%` }} />
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
        className="group flex items-start justify-between gap-3 rounded-xl border border-border bg-background p-3 transition-colors hover:border-primary/40 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex min-w-0 items-start gap-3">
          <span className={cn("mt-0.5 rounded-md border px-1.5 py-1 text-[10px] font-semibold", isSuccess
            ? "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
            : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300")}>
            {verdict}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-800 group-hover:text-sky-700">{finding.title}</p>
            <p className="mt-1 truncate text-xs text-slate-600">{campaignName} · {finding.category || "Uncategorized"}</p>
          </div>
        </div>
          <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-slate-500 group-hover:text-sky-700" aria-hidden />
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
    <main className={cn("min-h-full text-slate-900", !hideTitle && "bg-[#f3f6fa]")}>
      <div className={cn("mx-auto w-full max-w-[1600px]", !hideTitle ? "px-4 py-6 sm:px-6 lg:px-10 lg:py-9" : "px-0 py-2")}>
        {!hideTitle && (
          <header className="flex flex-col gap-6 border-b border-slate-200 pb-7 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">ARTSA <span className="text-slate-300">/</span> Security operations</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">Command Center</h1>
              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-600">Live assessments, defense reviews, and runtime health in one place.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("inline-flex h-10 items-center gap-2 rounded-full border px-3 text-xs font-medium", apiOnline
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700")}>
                <StatusDot tone={apiOnline ? "good" : "bad"} />API {apiOnline ? "connected" : "offline"}
              </span>
              <Button type="button" variant="ghost" size="icon" className="h-10 w-10 text-slate-700 hover:bg-slate-100 hover:text-slate-950" onClick={onRefresh} aria-label="Refresh Command Center data">
                <RefreshCw className="h-4 w-4" aria-hidden />
              </Button>
              <Button asChild variant="outline" className="h-10 gap-2 border-slate-300 bg-transparent text-slate-800 hover:bg-slate-100 hover:text-slate-950">
                <Link href="/red-team/monitor"><CircleAlert className="h-4 w-4" aria-hidden />Detections<ArrowUpRight className="h-3.5 w-3.5" aria-hidden /></Link>
              </Button>
            </div>
          </header>
        )}

        <section aria-label="Operations snapshot" className="mt-4 grid grid-cols-2 border-b border-slate-200 pb-4 md:grid-cols-4">
          <div className="border-r border-slate-200 px-3 py-1 first:pl-0 sm:px-5">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">Active assessments</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-950">{campaignsLoading ? "…" : activeCampaigns.length}</p>
            <p className="mt-1 text-xs text-slate-500">Campaigns in progress</p>
          </div>
          <div className="border-slate-200 px-3 py-1 md:border-r sm:px-5">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">Authorized targets</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-950">{targetsLoading ? "…" : authorizedTargets.length}</p>
            <p className="mt-1 text-xs text-slate-500">{targetsLoading ? "Checking targets" : `${mappedTargets.length} mapped · ${targets.length} registered`}</p>
          </div>
          <div className="border-r border-t border-slate-200 px-3 py-3 md:border-t-0 md:border-r sm:px-5 md:py-1">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">Defense reviews</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-950">{followUpCount}</p>
            <p className="mt-1 text-xs text-slate-500">Outcomes awaiting policy review</p>
          </div>
          <div className="border-t border-slate-200 px-3 py-3 md:border-t-0 sm:px-5 md:py-1">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">Campaign history</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-950">{campaignsLoading ? "…" : completedCampaigns.length}</p>
            <p className="mt-1 text-xs text-slate-500">Completed assessments</p>
          </div>
        </section>

        <section className="mt-5 grid items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <article aria-labelledby="running-title" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700"><Workflow className="h-4 w-4" aria-hidden /></span>
                <div>
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Assessment workspace</p>
                  <h2 id="running-title" className="mt-0.5 text-lg font-semibold text-slate-950">Campaigns</h2>
                </div>
              </div>
              <Link href="/red-team/campaigns" className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-700 transition hover:text-sky-900">All campaigns<ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link>
            </div>

            {campaignsLoading && activeCampaigns.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-slate-500" role="status">Loading assessment records…</div>
            ) : activeCampaigns.length > 0 ? (
              <ul className="grid gap-2 p-4 sm:p-5">{activeCampaigns.slice(0, 4).map((campaign) => <CampaignItem key={campaign.id} campaign={campaign} />)}</ul>
            ) : (
              <div className="p-5 sm:p-6">
                <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700"><CircleAlert className="h-4 w-4" aria-hidden /></span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-semibold text-slate-950">{readiness.title}</h3><span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-slate-500">Idle</span></div>
                      <p className="mt-1 max-w-xl text-sm leading-6 text-slate-600">{readiness.detail}</p>
                    </div>
                  </div>
                  {readiness.href && readiness.action ? (
                    <Button asChild className="h-10 shrink-0 gap-2 bg-slate-900 px-4 font-medium text-white hover:bg-slate-700">
                      <Link href={readiness.href}>{readiness.action}<ArrowRight className="h-4 w-4" aria-hidden /></Link>
                    </Button>
                  ) : <Button type="button" disabled className="h-10 shrink-0 bg-slate-200 px-4 text-slate-500">Checking readiness…</Button>}
                </div>
                <ol aria-label="Assessment readiness steps" className="mt-6 grid gap-3 border-t border-slate-200 pt-5 sm:grid-cols-2 xl:grid-cols-5">
                  <ReadinessRow title="API connection" detail={apiOnline ? "Endpoints reachable" : "Backend needs attention"} complete={apiOnline} />
                  <ReadinessRow title="Target authorization" detail={targetsLoading ? "Loading targets" : authorizedTargets.length > 0 ? `${authorizedTargets.length} authorized` : targets.length > 0 ? "Authorization required" : "No targets registered"} complete={!targetsLoading && authorizedTargets.length > 0} />
                  <ReadinessRow title="Surface discovery" detail={targetsLoading ? "Waiting for targets" : mappedTargets.length > 0 ? `${mappedTargets.length} mapped` : authorizedTargets.length > 0 ? "Discovery required" : "Waiting for authorization"} complete={!targetsLoading && mappedTargets.length > 0} />
                  <ReadinessRow title="Provider credential" detail={providersLoading ? "Checking providers" : readyTargets.length > 0 ? `${readyTargets.length} target${readyTargets.length === 1 ? "" : "s"} provider-ready` : "Configure target provider"} complete={!providersLoading && readyTargets.length > 0} />
                  <ReadinessRow title="Campaign focus" detail={activeCampaigns.length > 0 ? "Campaign in progress" : assessmentReady ? "Ready to choose" : "Waiting for readiness"} complete={activeCampaigns.length > 0} />
                </ol>
              </div>
            )}
            {activeCampaigns.length > 4 ? <p className="mt-3 text-xs text-slate-400">Showing 4 of {activeCampaigns.length} running assessments.</p> : null}
          </article>

          <article aria-labelledby="follow-up-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Evidence desk</p>
                <h2 id="follow-up-title" className="mt-1 text-lg font-semibold text-slate-950">Defense follow-up</h2>
                <p className="mt-1 text-xs leading-5 text-slate-600">Campaign outcomes that need a policy review.</p>
              </div>
              <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-sm tabular-nums text-slate-800">{followUpCount}</span>
            </div>
            {findingsLoading ? (
              <div className="mt-5 rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-600" role="status">Loading campaign outcomes…</div>
            ) : findingsUnavailable ? (
              <div className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/[0.05] px-4 py-5">
                <p className="text-sm font-medium text-amber-800">Review queue unavailable</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">The findings endpoint did not return data. Check the API before treating this queue as clear.</p>
              </div>
            ) : defenseFollowUps.length > 0 ? (
              <>
                <p className="mt-4 text-xs text-slate-600"><span className="font-semibold tabular-nums text-slate-950">{defenseFollowUps.length}</span> proven outcome{defenseFollowUps.length === 1 ? "" : "s"} awaiting review</p>
                <ul className="mt-3 space-y-2">{defenseFollowUps.slice(0, 4).map((finding) => <FindingFollowUp key={finding.id} finding={finding} campaignName={campaignById.get(finding.source_ref ?? "") ?? "Campaign result"} />)}</ul>
                {defenseFollowUps.length > 4 ? <Link href="/findings" className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-sky-700 hover:text-sky-800">Review all {defenseFollowUps.length}<ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link> : null}
              </>
            ) : (
              <div className="mt-5 rounded-xl bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-emerald-700"><Check className="h-4 w-4" aria-hidden /><p className="text-sm font-medium">Nothing waiting for review</p></div>
                <p className="mt-2 text-xs leading-5 text-slate-600">No unpromoted SUCCESS or PARTIAL campaign outcomes were returned. This does not mean every defense is secure.</p>
                <Link href="/findings" className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-sky-700 hover:text-sky-800">Open findings<ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link>
              </div>
            )}
          </article>
        </section>

        <section className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(330px,0.75fr)]">
          <article aria-labelledby="history-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Assessment record</p>
                <h2 id="history-title" className="mt-1 text-lg font-semibold text-slate-950">Recent completed runs</h2>
              </div>
              <Link href="/red-team/campaigns" className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-700 hover:text-sky-800">All campaigns<ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link>
            </div>
            {campaignsLoading && recentCompleted.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-600" role="status">Loading campaign history…</p>
            ) : recentCompleted.length > 0 ? (
              <ul className="divide-y divide-slate-200">
                {recentCompleted.map((campaign) => {
                  const summary = asRecord(campaign.summary);
                  const successes = verdictCount(summary, "SUCCESS");
                  const partials = verdictCount(summary, "PARTIAL");
                  const blocked = verdictCount(summary, "BLOCKED");
                  return (
                    <li key={campaign.id}>
                      <Link href={`/red-team/monitor/${encodeURIComponent(campaign.id)}?follow=0`} className="group grid gap-3 py-4 transition hover:bg-slate-50 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600"><ShieldCheck className="h-4 w-4" aria-hidden /></span>
                          <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-800 group-hover:text-sky-700">{campaign.name}</p><p className="mt-1 text-xs text-slate-500">{campaign.rounds_completed} of {campaign.total_rounds} rounds completed</p></div>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 pl-11 font-mono text-[10px] tabular-nums sm:pl-0">
                          <span className="text-rose-700">SUCCESS {successes ?? "—"}</span><span className="text-amber-700">PARTIAL {partials ?? "—"}</span><span className="text-emerald-700">BLOCKED {blocked ?? "—"}</span><ArrowUpRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-sky-700" aria-hidden />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="py-5 text-center">
                <p className="text-sm font-medium text-slate-800">No completed assessment yet</p>
                <p className="mt-1 text-xs text-slate-500">Judge outcomes will appear here when a campaign finishes.</p>
              </div>
            )}
          </article>

          <article aria-labelledby="system-status-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
              <div><p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Runtime assurance</p><h2 id="system-status-title" className="mt-1 text-lg font-semibold text-slate-950">Operational signals</h2></div>
              <Link href="/admin/system" className="pt-1 text-xs font-medium text-sky-700 hover:text-sky-800">System health<ArrowUpRight className="ml-1 inline h-3.5 w-3.5" aria-hidden /></Link>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">Telemetry is labeled live only when a campaign or event is reported by the API.</p>
            <div className="mt-4 space-y-0 divide-y divide-slate-200">
              <div className="flex items-center justify-between gap-3 py-3"><div className="flex items-center gap-2.5"><StatusDot tone={live ? "good" : liveOps.telemetryMode === "STALE" ? "warning" : "neutral"} /><span className="text-xs text-slate-600">Run telemetry</span></div><span className="text-xs font-medium text-slate-800">{live ? "Live" : liveOps.telemetryMode === "STALE" ? "Stale" : "Waiting"}</span></div>
              <div className="flex items-center justify-between gap-3 py-3"><div className="flex items-center gap-2.5"><Fingerprint className="h-3.5 w-3.5 text-slate-500" aria-hidden /><span className="text-xs text-slate-600">HMAC handoffs</span></div><span className="text-right text-xs font-medium text-slate-800">{live ? failedHandoffs > 0 ? `${failedHandoffs} failed` : verifiedHandoffs > 0 ? `${verifiedHandoffs} verified` : "No checks observed" : "No live checks"}</span></div>
              <div className="flex items-center justify-between gap-3 py-3"><div className="flex items-center gap-2.5"><Activity className="h-3.5 w-3.5 text-slate-500" aria-hidden /><span className="text-xs text-slate-600">WebSocket</span></div><span className="text-xs font-medium text-slate-800">{liveOps.connection.connected ? "Connected" : "Disconnected"}</span></div>
            </div>
            <p className="mt-1 border-t border-slate-200 pt-3 text-[10px] text-slate-500">Last event: {formatUtcTime(liveOps.connection.lastEventAt)} <span className="px-1 text-slate-700">·</span> reconnects {liveOps.connection.reconnectCount}</p>
          </article>
        </section>

        <details className="group mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-5 py-4 marker:hidden [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600"><Fingerprint className="h-4 w-4" aria-hidden /></span><span><span className="block text-sm font-semibold text-slate-950">Platform architecture</span><span className="mt-0.5 block text-xs text-slate-500">Six-agent chain and trust references</span></span></span>
            <span className="text-xs font-medium text-sky-700 group-open:hidden">Show details</span><span className="hidden text-xs font-medium text-sky-700 group-open:inline">Hide details</span>
          </summary>
          <div className="border-t border-slate-200 p-5 sm:p-6">
            <h3 className="text-sm font-semibold text-slate-950">Six-agent chain</h3>
            <p className="mt-1 text-xs text-slate-600">Research → Curator → Red Team → Target → Judge → Defender</p>
            <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
              {SIX_AGENTS.map((agent, index) => {
                const expected = agent.toLowerCase().replace(/[^a-z]/g, "");
                const snapshot = liveOps.agents.find((item) => item.role.toLowerCase().replace(/[^a-z]/g, "") === expected || item.agentId.toLowerCase().replace(/[^a-z]/g, "") === expected);
                return <li key={agent} className="rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="font-mono text-[10px] font-semibold tabular-nums text-slate-500">0{index + 1}</p><p className="mt-2 truncate text-xs font-semibold text-slate-800">{agent}</p><p className="mt-1 text-[10px] capitalize text-slate-500">{live ? snapshot?.state?.replaceAll("_", " ") ?? "No signal" : "Architecture reference"}</p></li>;
              })}
            </ol>
            <Link href="/red-team/coverage" className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:text-sky-800">Review agentic coverage<ArrowUpRight className="h-3.5 w-3.5" aria-hidden /></Link>
          </div>
        </details>

        {liveOps.error ? <p role="status" className="mt-4 rounded-lg border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3 text-sm text-amber-800">Telemetry could not refresh: {liveOps.error}</p> : null}
      </div>
    </main>
  );
}
