"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDashboardMetrics } from "@/lib/context/DashboardMetricsProvider";
import { useConnection } from "@/lib/context/ConnectionProvider";
import { publishRedTeamChrome } from "@/components/red-team/RedTeamShell";
import { LiveAiActivityViz } from "@/components/red-team/LiveAiActivityViz";
import { Button } from "@/components/ui/button";
import {
  LIVE_AGENTS,
  formatEventTime,
  type LiveMonitorEvent,
  type LiveOutcome,
} from "@/lib/liveMonitorEvents";
import {
  agentsFromTelemetry,
  buildLiveAiActivity,
  ingestDetectionStats,
  liveIngestStreamNewestFirst,
  severityBuckets,
} from "@/lib/redTeamLiveIngest";
import { cn } from "@/lib/utils";

const ROW_H = 40;
const VIEWPORT_H = 320;

function outcomeBorder(outcome: LiveOutcome | null | undefined): string {
  if (outcome === "pass") return "border-l-[hsl(var(--severity-low))]";
  if (outcome === "fail") return "border-l-[hsl(var(--severity-critical))]";
  if (outcome === "flag") return "border-l-[hsl(var(--severity-medium))]";
  return "border-l-border";
}

function RiskPulseRail({ events }: { events: LiveMonitorEvent[] }) {
  const recent = events.slice(0, 40);
  if (!recent.length) {
    return (
      <div className="flex h-14 items-center justify-center rounded-md border border-dashed border-border text-[12px] text-muted-foreground">
        Waiting for live AI activity…
      </div>
    );
  }
  return (
    <div className="rounded-md border border-border p-3">
      <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>Live event pulse</span>
        <span className="font-mono tabular-nums">{recent.length} recent</span>
      </div>
      <div className="flex gap-1 overflow-x-auto pb-1">
        {recent.map((e) => {
          const tone =
            e.outcome === "fail" ? "bad" : e.outcome === "pass" ? "ok" : "warn";
          return (
            <div
              key={`${e.seq}-${e.ts}`}
              title={e.summary}
              className={cn(
                "h-9 w-2.5 shrink-0 rounded-sm",
                tone === "bad" && "animate-pulse bg-[hsl(var(--severity-critical))]",
                tone === "ok" && "bg-[hsl(var(--severity-low))]",
                tone === "warn" && "bg-[hsl(var(--severity-medium))]"
              )}
            />
          );
        })}
      </div>
    </div>
  );
}

function VirtualStream({ events }: { events: LiveMonitorEvent[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    if (!scrollerRef.current) return;
    scrollerRef.current.scrollTop = 0;
    setScrollTop(0);
  }, [events[0]?.seq, events.length]);

  const total = events.length;
  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - 4);
  const visible = Math.ceil(VIEWPORT_H / ROW_H) + 8;
  const end = Math.min(total, start + visible);
  const slice = events.slice(start, end);

  return (
    <div
      ref={scrollerRef}
      className="relative overflow-y-auto rounded-md border border-border bg-[#0a0a0a]/40"
      style={{ height: VIEWPORT_H }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      role="log"
      aria-live="polite"
      aria-label="Live AI activity stream"
    >
      {total === 0 ? (
        <p className="px-4 py-12 text-center text-[13px] text-muted-foreground">
          No live AI activity yet. Connect any app to{" "}
          <span className="font-mono">/api/v1/ingest</span> (SDK or HTTP) and send traffic — every
          scan appears here with full visualization.
        </p>
      ) : (
        <div style={{ height: total * ROW_H, position: "relative" }}>
          {slice.map((e, i) => {
            const idx = start + i;
            return (
              <div
                key={`${e.seq}-${e.ts}-${e.summary}`}
                className={cn(
                  "absolute left-0 right-0 flex items-start gap-3 border-l-2 px-3 py-2 text-[13px]",
                  outcomeBorder(e.outcome)
                )}
                style={{ top: idx * ROW_H, height: ROW_H }}
              >
                <span className="w-[4.5rem] shrink-0 font-mono text-[11px] text-muted-foreground">
                  {formatEventTime(e.ts)}
                </span>
                <span className="min-w-0 flex-1 truncate text-foreground">{e.summary}</span>
                <span
                  className={cn(
                    "shrink-0 font-mono text-[10px] uppercase",
                    e.outcome === "fail" && "text-[hsl(var(--severity-critical))]",
                    e.outcome === "pass" && "text-[hsl(var(--severity-low))]",
                    e.outcome === "flag" && "text-[hsl(var(--severity-medium))]"
                  )}
                >
                  {e.outcome ?? "—"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Full live AI activity theater — path, charts, agents, detectors, stream. */
export default function RedTeamLiveIngestMonitorPage() {
  const { liveEvents, connected, metrics } = useDashboardMetrics();
  const { apiOnline, wsConnected } = useConnection();

  const stream = useMemo(() => liveIngestStreamNewestFirst(liveEvents), [liveEvents]);
  const agents = useMemo(() => agentsFromTelemetry(liveEvents), [liveEvents]);
  const stats = useMemo(() => ingestDetectionStats(liveEvents), [liveEvents]);
  const sev = useMemo(() => severityBuckets(liveEvents), [liveEvents]);
  const activity = useMemo(() => buildLiveAiActivity(liveEvents), [liveEvents]);
  const live = apiOnline && (connected || wsConnected);

  useEffect(() => {
    publishRedTeamChrome(
      live ? (stream.length ? "live" : "connecting") : apiOnline ? "stalled" : "error"
    );
    return () => publishRedTeamChrome("idle");
  }, [live, stream.length, apiOnline]);

  return (
    <div className="flex min-h-[calc(100vh-12rem)] flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">AI Activity</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Live traffic from any application wired to ARTSA ingest. Campaign attack rounds live
            under Campaign Monitor.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[11px]",
              live
                ? "border-[hsl(var(--severity-low-border))] text-[hsl(var(--severity-low))]"
                : "border-border text-muted-foreground"
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                live ? "animate-pulse bg-[hsl(var(--severity-low))]" : "bg-muted-foreground/40"
              )}
            />
            {live ? "LIVE" : "OFFLINE"}
            {" · "}
            {connected || wsConnected ? "ws" : "poll"}
            {" · "}
            {stats.total} evt
          </span>
          <Button size="sm" variant="outline" asChild>
            <Link href="/red-team/monitor">Monitor hub</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/red-team/campaigns/new">Run campaign</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/dashboard">Command Center</Link>
          </Button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(
          [
            ["Events", String(stats.total)],
            ["Detect", stats.detectPct != null ? `${stats.detectPct}%` : "—"],
            ["Max risk", String(Math.round(metrics.max_risk_score || 0))],
            [
              "Critical",
              String(sev.CRITICAL),
            ],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-md border border-border px-3 py-2.5">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            <p
              className={cn(
                "mt-0.5 font-mono text-[20px] font-semibold tabular-nums",
                label === "Critical" && sev.CRITICAL > 0
                  ? "text-[hsl(var(--severity-critical))]"
                  : "text-foreground"
              )}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      <RiskPulseRail events={stream} />

      <div className="flex flex-wrap items-center gap-4 rounded-md border border-border px-3 py-2">
        {LIVE_AGENTS.map((a) => {
          const st = agents[a.id] ?? "idle";
          return (
            <div key={a.id} className="flex items-center gap-1.5 text-[11px]">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  st === "running" && "animate-pulse bg-[#6798ff]",
                  st === "done" && "bg-[hsl(var(--severity-low))]",
                  st === "idle" && "bg-muted-foreground/35"
                )}
              />
              <span className="text-muted-foreground">{a.label}</span>
            </div>
          );
        })}
      </div>

      {/* Full AI activity visualization */}
      <LiveAiActivityViz model={activity} />

      {/* Stream + severity */}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px]">
        <section className="min-w-0 space-y-2">
          <div className="flex items-baseline justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Live activity stream
            </h3>
            <span className="font-mono text-[10px] text-muted-foreground">{stream.length}</span>
          </div>
          <VirtualStream events={stream} />
        </section>

        <aside className="rounded-md border border-border px-3 py-3 lg:sticky lg:top-2 lg:self-start">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Severity mix
          </p>
          <div className="space-y-2 font-mono text-[11px]">
            {(
              [
                ["CRITICAL", sev.CRITICAL, "bg-[hsl(var(--severity-critical))]"],
                ["HIGH", sev.HIGH, "bg-[hsl(var(--severity-high))]"],
                ["MEDIUM", sev.MEDIUM, "bg-[hsl(var(--severity-medium))]"],
                ["LOW", sev.LOW, "bg-muted-foreground/40"],
              ] as const
            ).map(([label, n, bar]) => {
              const pct = stats.total > 0 ? Math.round((n / stats.total) * 100) : 0;
              return (
                <div key={label}>
                  <div className="mb-0.5 flex justify-between">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="text-foreground">{n}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full", bar)} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}
