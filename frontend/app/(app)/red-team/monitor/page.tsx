"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useCampaigns } from "@/lib/hooks/useCampaigns";
import { useDashboardMetrics } from "@/lib/context/DashboardMetricsProvider";
import { useConnection } from "@/lib/context/ConnectionProvider";
import { WatchTile } from "@/components/red-team/WatchTile";
import { Button } from "@/components/ui/button";
import { ingestDetectionStats, severityBuckets } from "@/lib/redTeamLiveIngest";
import { cn } from "@/lib/utils";

/** Monitor hub — app ingest live vs campaign rounds. */
export default function MonitorIndexPage() {
  const { campaigns, loading } = useCampaigns();
  const { liveEvents, connected, metrics } = useDashboardMetrics();
  const { apiOnline, wsConnected } = useConnection();

  const running = useMemo(
    () =>
      campaigns.filter((c) => {
        const s = String(c.status).toUpperCase();
        return s === "RUNNING" || s === "PENDING";
      }),
    [campaigns]
  );

  const preferred = running[0] ?? campaigns[0] ?? null;
  const stats = useMemo(() => ingestDetectionStats(liveEvents), [liveEvents]);
  const sev = useMemo(() => severityBuckets(liveEvents), [liveEvents]);
  const live = apiOnline && (connected || wsConnected);
  const latest = liveEvents[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Live Monitor</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Two live views: traffic from any connected app, and simulated campaign rounds.
          </p>
        </div>
        <Button size="sm" variant="outline" asChild>
          <Link href="/red-team/campaigns/new">New campaign</Link>
        </Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* Containment / any connected app */}
        <section
          className={cn(
            "rounded-md border px-4 py-4",
            live && stats.total > 0
              ? "border-[hsl(var(--severity-critical))]/35 bg-[hsl(var(--severity-critical))]/5"
              : "border-border"
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  AI Activity
                </p>
                <span
                  className={cn(
                    "font-mono text-[10px] uppercase",
                    live ? "text-[hsl(var(--severity-low))]" : "text-muted-foreground"
                  )}
                >
                  {live ? "● live" : "○ offline"}
                </span>
              </div>
              <p className="mt-1 text-[15px] font-medium tracking-tight">Any connected application</p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Live prompts & tool calls from apps that send telemetry to ARTSA ingest — SDK, API,
                or gateway. Not limited to one vendor.
              </p>
              <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                {stats.total} events · detect{" "}
                {stats.detectPct != null ? `${stats.detectPct}%` : "—"} · max R
                {Math.round(metrics.max_risk_score || 0)}
              </p>
              {latest ? (
                <p className="mt-2 truncate text-[13px] text-foreground">
                  Latest: {String(latest.agent_id ?? "agent")} · {String(latest.tool_name ?? "tool")} ·{" "}
                  {String(latest.verdict ?? "—")} · R{Math.round(Number(latest.risk_score ?? 0))}
                </p>
              ) : (
                <p className="mt-2 text-[13px] text-muted-foreground">
                  Waiting for ingest — point any app at{" "}
                  <span className="font-mono">/api/v1/ingest</span> with your API key.
                </p>
              )}
            </div>
            <Button size="sm" asChild>
              <Link href="/red-team/monitor/live">Open AI Activity</Link>
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-3 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            <span className="text-[hsl(var(--severity-critical))]">C {sev.CRITICAL}</span>
            <span className="text-[hsl(var(--severity-high))]">H {sev.HIGH}</span>
            <span className="text-[hsl(var(--severity-medium))]">M {sev.MEDIUM}</span>
            <span>L {sev.LOW}</span>
            <span className="normal-case tracking-normal">
              {connected || wsConnected ? "ws" : "poll"}
            </span>
          </div>
        </section>

        {/* Campaign theater */}
        <section className="rounded-md border border-border px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Campaign live
              </p>
              <p className="mt-1 text-[15px] font-medium tracking-tight">
                {preferred ? preferred.name : "No campaign yet"}
              </p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Simulated red-team rounds against your target model — separate from live app traffic.
              </p>
              {preferred ? (
                <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                  {preferred.status} · {preferred.rounds_completed}/{preferred.total_rounds} rounds
                  {running.length > 1 ? ` · ${running.length} running` : ""}
                </p>
              ) : (
                <p className="mt-2 text-[13px] text-muted-foreground">
                  Launch a campaign to stream attack rounds here.
                </p>
              )}
            </div>
            {preferred ? (
              <Button size="sm" asChild>
                <Link href={`/red-team/monitor/${preferred.id}?follow=1`}>Open theater</Link>
              </Button>
            ) : (
              <Button size="sm" asChild>
                <Link href="/red-team/campaigns/new">Create campaign</Link>
              </Button>
            )}
          </div>
        </section>
      </div>

      {running.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Running campaigns
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {running.map((c) => (
              <WatchTile
                key={c.id}
                campaignId={c.id}
                name={c.name}
                status={c.status}
                roundsCompleted={c.rounds_completed}
                totalRounds={c.total_rounds}
                live
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          All campaigns
        </h3>
        {loading && campaigns.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">Loading…</p>
        ) : campaigns.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-[13px] text-muted-foreground">
            No campaigns yet — AI Activity still works above for any connected application.{" "}
            <Link href="/red-team/lab" className="underline-offset-2 hover:underline">
              Attack Lab
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {campaigns.slice(0, 16).map((c) => (
              <li key={c.id}>
                <Link
                  href={`/red-team/monitor/${c.id}`}
                  className="flex items-center justify-between gap-2 px-3 py-2.5 text-[13px] hover:bg-muted/25"
                >
                  <span className="truncate font-medium">{c.name}</span>
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                    {c.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
