"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { LandingMotionCard } from "@/components/landing/LandingMotionCard";
import { RedTeamGlossary } from "@/components/red-team/RedTeamGlossary";
import { Button } from "@/components/ui/button";
import {
  CHART_AXIS_TICK,
  CHART_CRITICAL,
  CHART_GRID,
  CHART_PRIMARY,
  CHART_TOOLTIP_PROPS,
} from "@/lib/chartTheme";
import { useConnection } from "@/lib/context/ConnectionProvider";
import { useDashboardMetrics } from "@/lib/context/DashboardMetricsProvider";
import { riskScoreFromSummary } from "@/lib/assessmentResults";
import { useCampaigns } from "@/lib/hooks/useCampaigns";
import {
  buildLiveAiActivity,
  deriveLiveResearchAnalytics,
  filterEventsByWindow,
  severityBuckets,
  type LiveMonitorEventRow,
  type LiveMonitorWindow,
} from "@/lib/redTeamLiveIngest";
import { downloadJson, downloadTextFile, rowsToCsv } from "@/lib/redTeamExport";
import { deriveRedTeamOverview } from "@/lib/redTeamOverview";
import { toast } from "@/lib/stores/toast";
import { cn } from "@/lib/utils";

function ageLabel(sec: number | null): string {
  if (sec == null) return "—";
  if (sec < 5) return "now";
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  return `${Math.floor(sec / 3600)}h`;
}

/** Live Monitor — real ingest + campaigns, full blotter, deep analysis. */
export default function MonitorIndexPage() {
  const { campaigns, loading } = useCampaigns();
  const { liveEvents, connected, metrics, pullTelemetryRecent } = useDashboardMetrics();
  const { apiOnline, wsConnected } = useConnection();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [desk, setDesk] = useState<"traffic" | "campaigns">("traffic");
  const [deskPicked, setDeskPicked] = useState(false);
  const [windowFilter, setWindowFilter] = useState<LiveMonitorWindow>("all");
  const [, setTick] = useState(0);

  // Keep “age” labels live without inventing data.
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 2000);
    return () => window.clearInterval(id);
  }, []);

  const windowedEvents = useMemo(
    () => filterEventsByWindow(liveEvents, windowFilter),
    [liveEvents, windowFilter]
  );

  const research = useMemo(
    () => deriveLiveResearchAnalytics(windowedEvents),
    [windowedEvents]
  );
  const activity = useMemo(() => buildLiveAiActivity(windowedEvents), [windowedEvents]);
  const sev = useMemo(() => severityBuckets(windowedEvents), [windowedEvents]);
  const overview = useMemo(() => deriveRedTeamOverview(campaigns), [campaigns]);

  const running = useMemo(
    () =>
      campaigns.filter((c) => {
        const s = String(c.status).toUpperCase();
        return s === "RUNNING" || s === "PENDING";
      }),
    [campaigns]
  );
  const preferred = running[0] ?? campaigns[0] ?? null;

  // Prefer campaigns desk when there are live runs but no agent traffic yet.
  useEffect(() => {
    if (deskPicked || loading) return;
    if (research.n === 0 && running.length > 0) {
      setDesk("campaigns");
      setDeskPicked(true);
    } else if (research.n > 0 || campaigns.length > 0 || !loading) {
      setDeskPicked(true);
    }
  }, [deskPicked, loading, research.n, running.length, campaigns.length]);

  const campaignRiskRows = useMemo(
    () =>
      overview.campaignRisk
        .slice()
        .sort((a, b) => b.risk - a.risk)
        .slice(0, 12),
    [overview.campaignRisk]
  );

  const selected =
    research.eventRows.find((r) => r.id === selectedId) ?? research.eventRows[0] ?? null;

  useEffect(() => {
    if (research.eventRows[0] && !selectedId) {
      setSelectedId(research.eventRows[0].id);
    }
  }, [research.eventRows, selectedId]);

  const live = apiOnline && (connected || wsConnected);
  const riskSpark = windowedEvents
    .slice(0, 32)
    .map((e) => Number(e.risk_score ?? 0))
    .reverse();

  const refresh = async () => {
    setRefreshing(true);
    await pullTelemetryRecent(true);
    setRefreshing(false);
  };

  const exportSample = (fmt: "csv" | "json") => {
    const sample = research.eventRows.slice(0, 100);
    if (!sample.length) {
      toast("Nothing to export", {
        description: "No events in the current analysis window.",
        variant: "error",
      });
      return;
    }
    if (fmt === "json") {
      downloadJson(`artsa-monitor-${windowFilter}-${Date.now()}.json`, {
        window: windowFilter,
        exportedAt: new Date().toISOString(),
        n: sample.length,
        events: sample,
      });
    } else {
      const csv = rowsToCsv(
        ["age_sec", "agent", "tool", "verdict", "risk", "action", "session", "detectors", "ts"],
        sample.map((r) => [
          r.ageSec ?? "",
          r.agent,
          r.tool,
          r.verdict,
          r.risk,
          r.action,
          r.session,
          r.detectors.join("|"),
          r.ts,
        ])
      );
      downloadTextFile(`artsa-monitor-${windowFilter}-${Date.now()}.csv`, csv);
    }
    toast(`Exported ${fmt.toUpperCase()}`, {
      description: `${sample.length} events · window ${windowFilter}`,
      variant: "success",
    });
  };

  const postureTone =
    research.posture === "critical"
      ? {
          border: "border-[hsl(var(--severity-critical-border))]",
          bg: "bg-[hsl(var(--severity-critical-subtle))]",
          bar: "bg-[hsl(var(--severity-critical))]",
          text: "text-[hsl(var(--severity-critical))]",
        }
      : research.posture === "elevated"
        ? {
            border: "border-[hsl(var(--severity-medium-border))]",
            bg: "bg-[hsl(var(--severity-medium-subtle))]",
            bar: "bg-[hsl(var(--severity-medium))]",
            text: "text-[hsl(var(--severity-medium))]",
          }
        : research.posture === "empty"
          ? { border: "border-dashed border-border", bg: "bg-card", bar: "bg-muted-foreground/40", text: "text-muted-foreground" }
          : {
              border: "border-[hsl(var(--severity-low-border))]",
              bg: "bg-[hsl(var(--severity-low-subtle))]",
              bar: "bg-[hsl(var(--severity-low))]",
              text: "text-[hsl(var(--severity-low))]",
            };

  return (
    <div className="space-y-6">
      {/* Live transport status */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
          <LivePill on={apiOnline} label="Connected" />
          <LivePill on={connected || wsConnected} label="Live feed" />
          <span className="text-muted-foreground">
            {research.n}
            {windowFilter !== "all" && liveEvents.length !== research.n
              ? `/${liveEvents.length}`
              : ""}{" "}
            events · {research.sessionCount} sessions
            {research.latestAgeSec != null ? ` · updated ${ageLabel(research.latestAgeSec)} ago` : ""}
            {windowFilter !== "all" ? ` · window ${windowFilter}` : ""}
          </span>
          {live ? (
            <span className="inline-flex items-center gap-1.5 text-primary">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inset-0 animate-ping rounded-full bg-primary/50" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              LIVE
            </span>
          ) : (
            <span className="text-muted-foreground">OFFLINE</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <div
            className="flex flex-wrap gap-1 rounded-md border border-border bg-muted/30 p-1"
            role="group"
            aria-label="Analysis window"
          >
            {(
              [
                ["all", "All"],
                ["15m", "15m"],
                ["1h", "1h"],
                ["session", "Session"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setWindowFilter(id)}
                className={cn(
                  "rounded-sm px-2 py-1 font-mono text-[10px] transition-colors",
                  windowFilter === id
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={research.eventRows.length === 0}
            onClick={() => exportSample("csv")}
          >
            Export CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={research.eventRows.length === 0}
            onClick={() => exportSample("json")}
          >
            Export JSON
          </Button>
          <Button size="sm" variant="outline" disabled={refreshing} onClick={() => void refresh()}>
            {refreshing ? "Refreshing…" : "Refresh"}
          </Button>
          {preferred ? (
            <Button size="sm" asChild>
              <Link href={`/red-team/monitor/${preferred.id}?follow=1`}>
                {running.length ? "Watch live run" : "Open run"}
              </Link>
            </Button>
          ) : null}
          <Button size="sm" variant="outline" asChild>
            <Link href="/red-team/monitor/live">Activity</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/red-team/lab">Attack Lab</Link>
          </Button>
        </div>
      </div>

      <div
        className="flex flex-wrap gap-1 rounded-md border border-border bg-muted/30 p-1"
        role="tablist"
        aria-label="Monitor desk"
      >
        <button
          type="button"
          role="tab"
          aria-selected={desk === "traffic"}
          onClick={() => {
            setDesk("traffic");
            setDeskPicked(true);
          }}
          className={cn(
            "rounded-sm px-3 py-1.5 text-[12px] font-medium transition-colors",
            desk === "traffic"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Live traffic
          <span className="ml-1.5 font-mono text-[10px] tabular-nums text-muted-foreground">
            {research.n}
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={desk === "campaigns"}
          onClick={() => {
            setDesk("campaigns");
            setDeskPicked(true);
          }}
          className={cn(
            "rounded-sm px-3 py-1.5 text-[12px] font-medium transition-colors",
            desk === "campaigns"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Campaigns
          <span className="ml-1.5 font-mono text-[10px] tabular-nums text-muted-foreground">
            {campaigns.length}
            {running.length ? ` · ${running.length} live` : ""}
          </span>
        </button>
      </div>

      <p className="text-[12px] text-muted-foreground">
        {desk === "traffic"
          ? "Agent ingest and checks — risk, tools, and verdicts as they arrive."
          : "Wargame / lab runs — open a theater to follow rounds."}
      </p>

      <RedTeamGlossary />

      {desk === "traffic" ? (
        <>
      {/* Finding + spark + severity */}
      <LandingMotionCard
        index={0}
        glow={false}
        className={cn("overflow-hidden border p-4 sm:p-5", postureTone.border, postureTone.bg)}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-6">
          <div className={cn("hidden w-1 shrink-0 rounded-full lg:block", postureTone.bar)} aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Live finding
              </p>
              <span
                className={cn(
                  "rounded-sm border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider",
                  postureTone.border,
                  "bg-card/60",
                  postureTone.text
                )}
              >
                {research.posture}
              </span>
            </div>
            <p className="mt-2 text-[15px] leading-relaxed text-foreground">{research.finding}</p>
            {research.n === 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" asChild>
                  <Link href="/red-team/lab">Open Attack Lab</Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href="/red-team/campaigns/new">Start a campaign</Link>
                </Button>
                {campaigns.length > 0 ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setDesk("campaigns");
                      setDeskPicked(true);
                    }}
                  >
                    View campaigns
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="w-full shrink-0 rounded-md border border-border bg-card p-3 shadow-sm lg:w-[220px]">
            <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              Risk spark · live
            </p>
            <div className="mt-2 flex h-14 items-end gap-0.5 rounded-sm bg-muted/60 px-1 py-1">
              {(riskSpark.length ? riskSpark : [0]).map((r, i) => {
                const h = Math.max(6, Math.round((r / 100) * 48));
                const tone =
                  r >= 80
                    ? "bg-[hsl(var(--severity-critical))]"
                    : r >= 60
                      ? "bg-[hsl(var(--severity-high))]"
                      : r >= 40
                        ? "bg-[hsl(var(--severity-medium))]"
                        : r > 0
                          ? "bg-[hsl(var(--severity-low))]"
                          : "bg-muted-foreground/25";
                return (
                  <span
                    key={`${i}-${r}`}
                    className={cn("min-w-[3px] flex-1 rounded-sm", tone)}
                    style={{ height: h }}
                    title={`R${r}`}
                  />
                );
              })}
            </div>
            <div className="mt-2 flex justify-between font-mono text-[10px] tabular-nums text-muted-foreground">
              <span>μ {research.meanRisk ?? "—"}</span>
              <span className={cn(research.maxRisk >= 80 && "text-[hsl(var(--severity-critical))]")}>
                max {research.maxRisk || "—"}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              ["CRITICAL", sev.CRITICAL, "bg-[hsl(var(--severity-critical))]"],
              ["HIGH", sev.HIGH, "bg-[hsl(var(--severity-high))]"],
              ["MEDIUM", sev.MEDIUM, "bg-[hsl(var(--severity-medium))]"],
              ["LOW", sev.LOW, "bg-[hsl(var(--severity-low))]"],
            ] as const
          ).map(([label, count, fill]) => (
            <div key={label} className="rounded-md border border-border bg-card/70 px-2.5 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  {label}
                </span>
                <span className="font-mono text-[14px] tabular-nums text-foreground">{count}</span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full", fill)}
                  style={{
                    width: `${research.n ? Math.min(100, (count / research.n) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </LandingMotionCard>

      {/* KPI strip */}
      {research.n > 0 ? (
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        <Stat label="n" value={String(research.n)} />
        <Stat label="μ risk" value={fmt(research.meanRisk)} />
        <Stat label="median" value={fmt(research.medianRisk)} />
        <Stat label="p95" value={fmt(research.p95Risk)} hot={(research.p95Risk ?? 0) >= 80} />
        <Stat label="max" value={String(research.maxRisk)} hot={research.maxRisk >= 80} />
        <Stat label="breach %" value={pct(research.breachRate)} hot={(research.breachRate ?? 0) >= 20} />
        <Stat label="contain %" value={pct(research.containRate)} />
        <Stat
          label="Δ risk"
          value={
            research.riskDelta == null
              ? "—"
              : research.riskDelta > 0
                ? `+${research.riskDelta}`
                : String(research.riskDelta)
          }
          hot={(research.riskDelta ?? 0) > 8}
        />
      </section>
      ) : null}

      {/* Live blotter + inspect */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.9fr)]">
        <LandingMotionCard index={1} glow={false} className="border border-border bg-card p-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2.5">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Live activity
              </p>
              <p className="text-[11px] text-muted-foreground">
                Newest first — select a row to see details
              </p>
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">
              {research.eventRows.length} shown
            </span>
          </div>
          {research.eventRows.length === 0 ? (
            <div className="space-y-3 px-4 py-10 text-center">
              <p className="text-[14px] text-foreground">No activity yet</p>
              <p className="mx-auto max-w-sm text-[13px] text-muted-foreground">
                When your AI agents are tested, every scan shows up here. Start with a quick check
                or open Attack Lab.
              </p>
              <div className="flex flex-wrap justify-center gap-2 pt-1">
                <Button size="sm" asChild>
                  <Link href="/red-team/lab">Open Attack Lab</Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href="/red-team/campaigns/new">Start a campaign</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full min-w-[640px] text-left text-[12px]">
                <thead className="sticky top-0 z-[1] border-b border-border bg-muted/40 font-mono text-[9px] uppercase tracking-wider text-muted-foreground backdrop-blur">
                  <tr>
                    <th className="px-3 py-2 font-medium">Age</th>
                    <th className="px-3 py-2 font-medium">Agent</th>
                    <th className="px-3 py-2 font-medium">Tool</th>
                    <th className="px-3 py-2 font-medium">Verdict</th>
                    <th className="px-3 py-2 font-medium">Risk</th>
                    <th className="px-3 py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {research.eventRows.map((row) => {
                    const active = selected?.id === row.id;
                    return (
                      <tr
                        key={row.id}
                        className={cn(
                          "cursor-pointer transition-colors hover:bg-muted/25",
                          active && "bg-[hsl(var(--severity-info-subtle))]"
                        )}
                        onClick={() => setSelectedId(row.id)}
                      >
                        <td className="px-3 py-2 font-mono tabular-nums text-muted-foreground">
                          {ageLabel(row.ageSec)}
                        </td>
                        <td className="max-w-[7rem] truncate px-3 py-2 font-mono">{row.agent}</td>
                        <td className="max-w-[8rem] truncate px-3 py-2 font-mono">{row.tool}</td>
                        <td className="px-3 py-2">
                          <OutcomeChip outcome={row.outcome} label={row.verdict} />
                        </td>
                        <td
                          className={cn(
                            "px-3 py-2 font-mono tabular-nums",
                            row.risk >= 80 && "text-[hsl(var(--severity-critical))]"
                          )}
                        >
                          R{row.risk}
                        </td>
                        <td className="max-w-[6rem] truncate px-3 py-2 font-mono text-muted-foreground">
                          {row.action}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </LandingMotionCard>

        <LandingMotionCard index={2} glow={false} className="border border-border bg-card p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Event inspect
          </p>
          {!selected ? (
            <p className="mt-3 text-[13px] text-muted-foreground">Select a live event.</p>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <span
                  className={cn(
                    "font-mono text-[20px] font-semibold tabular-nums",
                    selected.risk >= 80
                      ? "text-[hsl(var(--severity-critical))]"
                      : "text-foreground"
                  )}
                >
                  R{selected.risk}
                </span>
                <OutcomeChip outcome={selected.outcome} label={selected.verdict} />
                <span className="font-mono text-[11px] text-muted-foreground">
                  {selected.severity} · {ageLabel(selected.ageSec)}
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-[12px]">
                <Field k="Agent" v={selected.agent} />
                <Field k="Tool" v={selected.tool} />
                <Field k="Session" v={selected.session} />
                <Field k="Action" v={selected.action} />
                <Field k="Timestamp" v={selected.ts || "—"} />
                <Field
                  k="Detectors"
                  v={selected.detectors.length ? selected.detectors.join(", ") : "—"}
                />
              </dl>
              <div>
                <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  Pipeline (from latest hop)
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {activity.pipeline.map((node, i) => (
                    <span key={node.id} className="inline-flex items-center gap-1">
                      {i > 0 ? <span className="text-muted-foreground/50">→</span> : null}
                      <span
                        className={cn(
                          "rounded-sm border px-2 py-0.5 font-mono text-[10px]",
                          node.hot
                            ? "border-[hsl(var(--severity-critical-border))] text-[hsl(var(--severity-critical))]"
                            : node.active
                              ? "border-border text-foreground"
                              : "border-border/50 text-muted-foreground"
                        )}
                      >
                        {node.label}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
              {selected.session !== "—" ? (
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/logs?session=${encodeURIComponent(selected.session)}`}>
                    Open in Logs
                  </Link>
                </Button>
              ) : null}
            </div>
          )}
        </LandingMotionCard>
      </div>

      {/* Charts — only after traffic exists */}
      {research.n > 0 ? (
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Risk distribution"
          hint="Histogram of live risk_score"
          empty={!research.histogram.some((h) => h.count > 0)}
          emptyHint="Risk bins fill as scored events arrive."
        >
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={research.histogram} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid {...CHART_GRID} />
                <XAxis dataKey="bin" tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
                <Tooltip {...CHART_TOOLTIP_PROPS} />
                <Bar dataKey="count" name="Events" radius={[2, 2, 0, 0]}>
                  {research.histogram.map((d) => (
                    <Cell key={d.bin} fill={d.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel
          title="Risk path + rolling mean"
          hint="Chronological · last 40"
          empty={research.rollingRisk.length < 2}
          emptyHint="Need a few events before a path appears."
        >
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={research.rollingRisk} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid {...CHART_GRID} />
                <XAxis dataKey="label" tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
                <Tooltip {...CHART_TOOLTIP_PROPS} />
                <Area
                  type="monotone"
                  dataKey="risk"
                  fill={CHART_PRIMARY}
                  fillOpacity={0.12}
                  stroke={CHART_PRIMARY}
                  strokeWidth={1.25}
                  name="Risk"
                />
                <Line
                  type="monotone"
                  dataKey="rolling"
                  stroke={CHART_CRITICAL}
                  strokeWidth={1.5}
                  dot={false}
                  name="Rolling μ"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel
          title="Outcome mix"
          hint="Breach / flag / contain"
          empty={!research.outcomeMix.length}
          emptyHint="Outcomes appear after scans are judged."
        >
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={research.outcomeMix} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid {...CHART_GRID} />
                <XAxis dataKey="name" tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
                <Tooltip {...CHART_TOOLTIP_PROPS} />
                <Bar dataKey="value" name="Count" radius={[2, 2, 0, 0]}>
                  {research.outcomeMix.map((d) => (
                    <Cell key={d.name} fill={d.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Concentration" hint="Volume × risk clusters">
          <dl className="grid grid-cols-2 gap-3 text-[13px]">
            <Conc
              k="Top tool"
              v={research.topTool ?? "—"}
              sub={research.topToolShare != null ? `${research.topToolShare}% of events` : undefined}
            />
            <Conc
              k="Top detector"
              v={research.topDetector ?? "—"}
              sub={research.detectorShare[0] ? `${research.detectorShare[0].share}% of hits` : undefined}
            />
            <Conc k="Critical share" v={pct(research.criticalShare)} />
            <Conc
              k="Throughput"
              v={
                research.eventsPerMin != null
                  ? `${research.eventsPerMin}/min`
                  : metrics.event_rate
                    ? `${metrics.event_rate}/win`
                    : "—"
              }
            />
          </dl>
        </Panel>
      </div>
      ) : null}

      {/* Tool + agent exposure */}
      {research.n > 0 ? (
      <div className="grid gap-4 lg:grid-cols-2">
        <ExposureTable
          title="Tool exposure"
          empty="Tools show up once agent traffic includes tool calls."
          rows={research.toolExposure.map((r) => ({
            name: r.tool,
            count: r.count,
            share: r.share,
            meanRisk: r.meanRisk,
            maxRisk: r.maxRisk,
          }))}
        />
        <ExposureTable
          title="Agent exposure"
          empty="Agents show up once traffic includes agent names."
          rows={research.agentExposure.map((r) => ({
            name: r.agent,
            count: r.count,
            share: r.share,
            meanRisk: r.meanRisk,
            maxRisk: r.maxRisk,
          }))}
        />
      </div>
      ) : null}

      {/* Detectors */}
      {research.n > 0 ? (
      <section className="space-y-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Detector contribution
        </h3>
        {research.detectorShare.length === 0 ? (
          <EmptyRow hint="Detector hits appear when a scan is flagged or blocked." />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {research.detectorShare.map((d) => (
              <li
                key={d.name}
                className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2.5"
              >
                <span className="truncate font-mono text-[11px] text-muted-foreground">{d.name}</span>
                <span className="shrink-0 font-mono text-[12px] tabular-nums text-foreground">
                  {d.hits} · {d.share}%
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      ) : null}
        </>
      ) : (
      /* Campaigns desk */
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Campaign theaters
            </h3>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Separate from live agent traffic — open a run to follow rounds.
            </p>
          </div>
          <Button size="sm" variant="outline" asChild>
            {preferred ? (
              <Link href={`/red-team/monitor/${preferred.id}?follow=1`}>Watch run</Link>
            ) : (
              <Link href="/red-team/campaigns/new">Start a campaign</Link>
            )}
          </Button>
        </div>
        {running.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {running.slice(0, 6).map((c) => (
              <Button key={c.id} size="sm" variant="outline" className="h-7 text-[11px]" asChild>
                <Link href={`/red-team/monitor/${c.id}?follow=1`}>
                  {c.name} · {c.rounds_completed}/{c.total_rounds}
                </Link>
              </Button>
            ))}
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Campaigns" value={String(campaigns.length)} />
          <Stat label="Running" value={String(overview.runningCount)} hot={overview.runningCount > 0} />
          <Stat label="Detect %" value={pct(overview.detectPct)} />
          <Stat label="Critical" value={String(overview.critical)} hot={overview.critical > 0} />
        </div>
        {loading && campaigns.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">Loading campaigns…</p>
        ) : campaignRiskRows.length === 0 ? (
          <div className="space-y-3 rounded-md border border-dashed border-border px-4 py-10 text-center">
            <p className="text-[14px] text-foreground">No campaigns yet</p>
            <p className="mx-auto max-w-sm text-[13px] text-muted-foreground">
              Start a run from Attack Lab or Campaigns. Live agent traffic stays on the other desk.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button size="sm" asChild>
                <Link href="/red-team/campaigns/new">Start a campaign</Link>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setDesk("traffic");
                  setDeskPicked(true);
                }}
              >
                View live traffic
              </Button>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {campaignRiskRows.map((c) => {
              const full = campaigns.find((x) => x.id === c.id);
              const risk = riskScoreFromSummary(full?.summary ?? null) ?? c.risk;
              const total = Math.max(1, Number(full?.total_rounds || 1));
              const done = Number(full?.rounds_completed || 0);
              const pctDone = Math.min(100, Math.round((done / total) * 100));
              const runningRow =
                String(c.status).toUpperCase() === "RUNNING" ||
                String(c.status).toUpperCase() === "PENDING";
              return (
                <li key={c.id}>
                  <Link
                    href={`/red-team/monitor/${c.id}?follow=1`}
                    className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-[13px] hover:bg-muted/20"
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        runningRow ? "animate-pulse bg-primary" : "bg-muted-foreground/40"
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate font-medium">{c.fullName}</span>
                    <span className="w-24 shrink-0">
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {done}/{total}
                      </span>
                      <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            runningRow ? "bg-primary" : "bg-foreground/45"
                          )}
                          style={{ width: `${pctDone}%` }}
                        />
                      </div>
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                      {c.status}
                    </span>
                    <span
                      className={cn(
                        "w-10 shrink-0 text-right font-mono text-[12px] tabular-nums",
                        risk >= 80 && "text-[hsl(var(--severity-critical))]"
                      )}
                    >
                      R{risk}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      )}
    </div>
  );
}

function LivePill({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5",
        on
          ? "border-[hsl(var(--severity-low-border))] text-[hsl(var(--severity-low))]"
          : "border-border text-muted-foreground"
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", on ? "bg-[hsl(var(--severity-low))]" : "bg-muted-foreground/40")} />
      {label}
    </span>
  );
}

function OutcomeChip({
  outcome,
  label,
}: {
  outcome: LiveMonitorEventRow["outcome"];
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-block max-w-[9rem] truncate rounded-sm border px-1.5 py-0.5 font-mono text-[10px]",
        outcome === "fail" &&
          "border-[hsl(var(--severity-critical-border))] text-[hsl(var(--severity-critical))]",
        outcome === "flag" &&
          "border-[hsl(var(--severity-medium-border))] text-[hsl(var(--severity-medium))]",
        outcome === "pass" &&
          "border-[hsl(var(--severity-low-border))] text-[hsl(var(--severity-low))]",
        !outcome && "border-border text-muted-foreground"
      )}
      title={label}
    >
      {label}
    </span>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{k}</dt>
      <dd className="mt-0.5 truncate font-mono text-[12px] text-foreground">{v}</dd>
    </div>
  );
}

function ExposureTable({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: Array<{ name: string; count: number; share: number; meanRisk: number; maxRisk: number }>;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {title}
        </h3>
        <span className="font-mono text-[10px] text-muted-foreground">count · share · μ · max</span>
      </div>
      {rows.length === 0 ? (
        <EmptyRow hint={empty} />
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[420px] text-left text-[12px]">
            <thead className="border-b border-border bg-muted/20 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Count</th>
                <th className="px-3 py-2 font-medium">Share</th>
                <th className="px-3 py-2 font-medium">μ</th>
                <th className="px-3 py-2 font-medium">Max</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.name} className="hover:bg-muted/15">
                  <td className="max-w-[10rem] truncate px-3 py-2 font-mono">{row.name}</td>
                  <td className="px-3 py-2 font-mono tabular-nums">{row.count}</td>
                  <td className="px-3 py-2 font-mono tabular-nums">{row.share}%</td>
                  <td className="px-3 py-2 font-mono tabular-nums">{row.meanRisk}</td>
                  <td
                    className={cn(
                      "px-3 py-2 font-mono tabular-nums",
                      row.maxRisk >= 80 && "text-[hsl(var(--severity-critical))]"
                    )}
                  >
                    {row.maxRisk}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  return String(n);
}

function pct(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${n}%`;
}

function Stat({ label, value, hot }: { label: string; value: string; hot?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-card px-2.5 py-2">
      <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 font-mono text-[17px] font-semibold tabular-nums",
          hot ? "text-[hsl(var(--severity-critical))]" : "text-foreground"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Conc({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{k}</dt>
      <dd className="mt-0.5 truncate font-mono text-[13px] text-foreground">{v}</dd>
      {sub ? <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

function Panel({
  title,
  hint,
  children,
  empty,
  emptyHint,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  empty?: boolean;
  emptyHint?: string;
}) {
  return (
    <section className="rounded-md border border-border bg-card p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {title}
        </h3>
        {hint ? <span className="font-mono text-[10px] text-muted-foreground">{hint}</span> : null}
      </div>
      {empty ? (
        <div className="flex h-[200px] items-center justify-center rounded-md border border-dashed border-border px-4 text-center text-[12px] text-muted-foreground">
          {emptyHint}
        </div>
      ) : (
        children
      )}
    </section>
  );
}

function EmptyRow({ hint }: { hint: string }) {
  return (
    <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-[12px] text-muted-foreground">
      {hint}
    </p>
  );
}
