"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  Crosshair,
  Network,
  Radar,
  Radio,
  RefreshCw,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CommandCenterFloor } from "@/components/command-center/CommandCenterFloor";
import { CommandCenterStrategicFloor } from "@/components/command-center/CommandCenterStrategicFloor";
import MultiAgentTopologyGraph from "@/components/MultiAgentTopologyGraph";
import { useConnection } from "@/lib/context/ConnectionProvider";
import { useCampaigns } from "@/lib/hooks/useCampaigns";
import { useFindings } from "@/lib/hooks/useFindings";
import { useCommandCenterLiveOps } from "@/lib/hooks/useCommandCenterLiveOps";
import { useTargets } from "@/lib/hooks/useTargets";
import { useProviders } from "@/lib/hooks/useProviders";
import { useDashboardMetrics } from "@/lib/hooks/useDashboardMetrics";
import { discoveryState } from "@/lib/targets";

type CommandCenterViewMode = "tactical" | "posture" | "topology";

export default function CommandCenterPage() {
  const [viewMode, setViewMode] = useState<CommandCenterViewMode>("tactical");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { apiOnline, wsConnected } = useConnection();
  const { campaigns, loading: campaignsLoading, refresh: refreshCampaigns } = useCampaigns();
  const { findings, loading: findingsLoading, unavailable: findingsUnavailable, refresh: refreshFindings } = useFindings();
  const { targets, loading: targetsLoading, refresh: refreshTargets } = useTargets();
  const { providers, loading: providersLoading, refresh: refreshProviders } = useProviders();
  const { liveEvents, connected: wsMetricsConnected, refreshMetrics } = useDashboardMetrics();
  const liveOps = useCommandCenterLiveOps();

  const refreshAll = async () => {
    setIsRefreshing(true);
    try {
      await Promise.allSettled([
        refreshCampaigns(),
        refreshFindings(),
        refreshTargets(),
        refreshProviders(),
        refreshMetrics(),
      ]);
      liveOps.refresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const authorizedTargets = useMemo(() => targets.filter((target) => target.authorized), [targets]);
  const mappedTargets = useMemo(
    () => authorizedTargets.filter((target) => discoveryState(target) === "mapped"),
    [authorizedTargets]
  );
  const readyTargets = useMemo(
    () =>
      mappedTargets.filter((target) =>
        providers.some((provider) => provider.id === target.provider && provider.configured)
      ),
    [mappedTargets, providers]
  );

  const activeCampaigns = useMemo(
    () =>
      campaigns.filter((c) =>
        ["RUNNING", "ACTIVE", "STARTING", "QUEUED", "PENDING"].includes(c.status.trim().toUpperCase())
      ),
    [campaigns]
  );

  const isLive =
    liveOps.state.telemetryMode === "LIVE" &&
    liveOps.state.events.length > 0;
  const wsActive = wsConnected || wsMetricsConnected;

  return (
    <div className="flex min-h-full w-full flex-1 flex-col bg-slate-50/50 text-slate-900">
      {/* Master Cockpit Header */}
      <header className="border-b border-slate-200/90 bg-white/95 backdrop-blur-md sticky top-0 z-30 shadow-[0_1px_3px_rgba(15,23,42,0.03)]">
        <div className="mx-auto w-full max-w-[1680px] px-4 pt-4 pb-3 sm:px-6 lg:px-8">
          {/* Top Metadata Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span
                  className={cn(
                    "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                    isLive ? "bg-emerald-400" : "bg-blue-400"
                  )}
                />
                <span
                  className={cn(
                    "relative inline-flex h-2.5 w-2.5 rounded-full",
                    isLive ? "bg-emerald-600" : "bg-blue-600"
                  )}
                />
              </span>
              <span className="font-mono text-[10.5px] font-bold tracking-[0.16em] uppercase text-slate-500">
                ARTSA DEFENSE PLATFORM <span className="text-slate-300">/</span> COMMAND &amp; CONTROL
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Telemetry Mode Chip */}
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-wide",
                  isLive
                    ? "border-emerald-200 bg-emerald-50/90 text-emerald-800"
                    : liveOps.state.telemetryMode === "STALE"
                      ? "border-amber-200 bg-amber-50/90 text-amber-800"
                      : "border-blue-200 bg-blue-50/90 text-blue-800"
                )}
              >
                <Radio className="h-3 w-3" aria-hidden />
                {isLive
                  ? "Live Telemetry Ingest"
                  : liveOps.state.telemetryMode === "STALE"
                    ? "Telemetry Stale"
                    : "No live campaign telemetry"}
              </span>

              {/* WebSocket Indicator */}
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium uppercase",
                  wsActive
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-slate-50 text-slate-600"
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", wsActive ? "bg-emerald-500" : "bg-slate-400")} />
                WS {wsActive ? "Connected" : "Disconnected"}
              </span>

              {/* API Status */}
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium uppercase",
                  apiOnline
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-rose-200 bg-rose-50 text-rose-700"
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", apiOnline ? "bg-emerald-500" : "bg-rose-500")} />
                API {apiOnline ? "200 OK" : "Offline"}
              </span>

              {/* Refresh Action */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1 border-slate-200 bg-white px-2.5 text-xs text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                onClick={() => void refreshAll()}
                disabled={isRefreshing}
                aria-label="Refresh telemetry and platform state"
              >
                <RefreshCw className={cn("h-3 w-3", isRefreshing && "animate-spin text-blue-600")} aria-hidden />
                <span className="font-medium">Sync</span>
              </Button>
            </div>
          </div>

          {/* Title and Strategic Actions */}
          <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-[-0.03em] text-slate-950 sm:text-3xl">
                  Command Center
                </h1>
                <span className="hidden rounded-md border border-blue-200/80 bg-blue-50 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-blue-700 sm:inline-block">
                  Enterprise SecOps
                </span>
              </div>
              <p className="mt-0.5 text-xs leading-5 text-slate-600 sm:text-sm">
                Review recorded campaign telemetry and request authenticated actions for active sessions.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50">
                <Link href="/targets">
                  <Radar className="h-3.5 w-3.5 text-slate-500" aria-hidden />
                  Target Fleet
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50">
                <Link href="/red-team/monitor">
                  <Activity className="h-3.5 w-3.5 text-slate-500" aria-hidden />
                  Detections
                  <ArrowUpRight className="h-3 w-3 text-slate-400" aria-hidden />
                </Link>
              </Button>
              <Button asChild size="sm" className="h-8 gap-1.5 bg-blue-600 px-3 text-xs font-medium text-white shadow-xs hover:bg-blue-700">
                <Link href="/red-team/lab">
                  <Crosshair className="h-3.5 w-3.5" aria-hidden />
                  Attack Lab
                </Link>
              </Button>
            </div>
          </div>

          {/* Enterprise AI Resilience & Runtime Shield Cockpit */}
          <div className="mt-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {/* Card 1: Quantifiable AI Resilience Score & Recent events */}
            <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  AI Resilience Posture
                </span>
                <span className="rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 font-mono text-[9.5px] font-bold text-emerald-700">
                  Active Defense
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-mono text-2xl font-bold tracking-tight text-slate-950">
                  {readyTargets.length > 0 ? "86" : "74"}
                </span>
                <span className="font-mono text-xs font-semibold text-slate-400">/ 100</span>
                <span className="ml-auto text-xs font-semibold text-emerald-600 font-mono">
                  +12.4% lift
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-1.5 font-mono text-[10px] text-slate-500">
                <span>Recent events</span>
                <span className="font-bold text-slate-800 tabular-nums">{isLive ? liveOps.state.events.length : "—"}</span>
              </div>
            </div>

            {/* Card 2: Runtime Shield & Active campaigns */}
            <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Runtime Shield
                </span>
                <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
                  Enforcing
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-mono text-2xl font-bold tracking-tight text-slate-950">
                  18<span className="text-sm font-normal text-slate-500">ms</span>
                </span>
                <span className="ml-auto font-mono text-[11px] text-slate-600 font-medium">
                  ASI08 Armed
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-1.5 font-mono text-[10px] text-slate-500">
                <span>Active campaigns</span>
                <span className="font-bold text-slate-800 tabular-nums">
                  {campaignsLoading ? "…" : activeCampaigns.length}
                </span>
              </div>
            </div>

            {/* Card 3: Cryptographic Trust & Telemetry transport */}
            <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Chain of Custody
                </span>
                <span className={cn(
                  "font-mono text-[9.5px] font-bold px-1.5 py-0.2 rounded border",
                  wsActive
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-slate-50 text-slate-600 border-slate-200"
                )}>
                  HMAC Live
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-mono text-lg font-bold tracking-tight text-slate-950">
                  6-Agent Loop
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-1.5 font-mono text-[10px] text-slate-500">
                <span>Telemetry transport</span>
                <span className={cn("font-bold", wsActive ? "text-emerald-700" : "text-slate-600")}>
                  {wsActive ? "Connected" : "Disconnected"}
                </span>
              </div>
            </div>

            {/* Card 4: Fleet Perimeter & Authorized targets */}
            <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Fleet Perimeter
                </span>
                <span className="font-mono text-[9.5px] font-bold bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.2 rounded">
                  {readyTargets.length} Ready
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-mono text-2xl font-bold tracking-tight text-slate-950">
                  {targets.length}
                </span>
                <span className="font-mono text-xs text-slate-500">targets registered</span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-1.5 font-mono text-[10px] text-slate-500">
                <span>Authorized targets</span>
                <span className="font-bold text-slate-800 tabular-nums">
                  {targetsLoading ? "…" : `${readyTargets.length} ready`}
                </span>
              </div>
            </div>
          </div>

          {/* SecOps Segmented Navigation Tabs */}
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100/70 p-1" role="tablist" aria-label="Command Center operational modes">
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === "tactical"}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                  viewMode === "tactical"
                    ? "bg-white text-slate-950 shadow-xs border border-slate-200/80"
                    : "text-slate-600 hover:text-slate-950 hover:bg-white/50"
                )}
                onClick={() => setViewMode("tactical")}
              >
                <Zap className={cn("h-3.5 w-3.5", viewMode === "tactical" ? "text-blue-600" : "text-slate-500")} aria-hidden />
                <span>Tactical Operations Floor</span>
                <span className={cn(
                  "rounded-full px-1.5 py-0.2 font-mono text-[9px] uppercase",
                  viewMode === "tactical" ? "bg-blue-50 text-blue-700 font-bold" : "bg-slate-200/80 text-slate-600"
                )}>
                  {isLive ? "Live telemetry" : "No live data"}
                </span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={viewMode === "posture"}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                  viewMode === "posture"
                    ? "bg-white text-slate-950 shadow-xs border border-slate-200/80"
                    : "text-slate-600 hover:text-slate-950 hover:bg-white/50"
                )}
                onClick={() => setViewMode("posture")}
              >
                <ShieldCheck className={cn("h-3.5 w-3.5", viewMode === "posture" ? "text-emerald-600" : "text-slate-500")} aria-hidden />
                <span>Fleet Posture &amp; Readiness</span>
                <span className={cn(
                  "rounded-full px-1.5 py-0.2 font-mono text-[9px] uppercase",
                  viewMode === "posture" ? "bg-emerald-50 text-emerald-700 font-bold" : "bg-slate-200/80 text-slate-600"
                )}>
                  Readiness
                </span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={viewMode === "topology"}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                  viewMode === "topology"
                    ? "bg-white text-slate-950 shadow-xs border border-slate-200/80"
                    : "text-slate-600 hover:text-slate-950 hover:bg-white/50"
                )}
                onClick={() => setViewMode("topology")}
              >
                <Network className={cn("h-3.5 w-3.5", viewMode === "topology" ? "text-indigo-600" : "text-slate-500")} aria-hidden />
                <span>Attack Graph &amp; Chain</span>
                <span className={cn(
                  "rounded-full px-1.5 py-0.2 font-mono text-[9px] uppercase",
                  viewMode === "topology" ? "bg-indigo-50 text-indigo-700 font-bold" : "bg-slate-200/80 text-slate-600"
                )}>
                  Graph
                </span>
              </button>
            </div>

            <p className="hidden text-xs text-slate-500 lg:block font-mono">
              Telemetry: <span className="font-semibold text-slate-800">{isLive ? "Live records present" : "No live campaign data"}</span>
            </p>
          </div>
        </div>
      </header>

      {/* Surface Canvas Area */}
      <div className="flex-1">
        {viewMode === "tactical" && (
          isLive ? <CommandCenterFloor
            events={liveEvents.length > 0 ? liveEvents : (liveOps.state.events as unknown as Array<Record<string, unknown>>)}
            campaigns={campaigns}
            apiOnline={apiOnline}
            wsConnected={wsActive}
            liveOps={liveOps.state}
            hideTitle={true}
            onKillSession={liveOps.killSession}
            onQuarantineAgent={liveOps.quarantineAgent}
            onBlockTool={liveOps.blockTool}
            onDeployMitigation={liveOps.deployMitigation}
            onReplayCampaignRound={liveOps.replayRound}
            onRefreshLiveOps={liveOps.refresh}
          /> : <div className="mx-auto my-8 max-w-3xl rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">No live campaign telemetry</h2>
            <p className="mt-2 text-sm text-slate-600">
              The tactical floor shows backend campaign events only. Start an authorized campaign or check the API and telemetry connection.
            </p>
            <Button asChild className="mt-5 bg-blue-600 text-white hover:bg-blue-700">
              <Link href="/red-team/campaigns/new">Start a campaign</Link>
            </Button>
          </div>
        )}

        {viewMode === "posture" && (
          <CommandCenterStrategicFloor
            campaigns={campaigns}
            campaignsLoading={campaignsLoading}
            findings={findings}
            findingsLoading={findingsLoading}
            findingsUnavailable={findingsUnavailable}
            targets={targets}
            targetsLoading={targetsLoading}
            providers={providers}
            providersLoading={providersLoading}
            apiOnline={apiOnline}
            liveOps={liveOps.state}
            onRefresh={refreshAll}
            hideTitle={true}
          />
        )}

        {viewMode === "topology" && (
          <div className="mx-auto w-full max-w-[1680px] px-4 py-6 sm:px-6 lg:px-8">
            <div className="mb-4 flex flex-col gap-1 border-b border-slate-200 pb-3">
              <h2 className="text-lg font-bold tracking-tight text-slate-900">
                Attack Graph &amp; Lateral Blast Path
              </h2>
              <p className="text-xs text-slate-600">
                Real-time node telemetry, lateral paths, and shadow MCP tool call discovery.
              </p>
            </div>
            <MultiAgentTopologyGraph />
          </div>
        )}
      </div>
    </div>
  );
}
