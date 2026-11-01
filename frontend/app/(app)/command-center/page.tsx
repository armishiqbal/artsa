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
    <div className="flex min-h-full w-full flex-1 flex-col bg-[#070707] text-neutral-100">
      {/* Master Cockpit Header */}
      <header className="border-b border-neutral-800 bg-[#0a0a0a]/95 backdrop-blur-md sticky top-0 z-30 shadow-[0_1px_3px_rgba(0,0,0,0.5)]">
        <div className="mx-auto w-full max-w-[1680px] px-4 pt-4 pb-3 sm:px-6 lg:px-8">
          {/* Top Metadata Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span
                  className={cn(
                    "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                    isLive ? "bg-emerald-400" : "bg-neutral-600"
                  )}
                />
                <span
                  className={cn(
                    "relative inline-flex h-2.5 w-2.5 rounded-full",
                    isLive ? "bg-emerald-500" : "bg-neutral-500"
                  )}
                />
              </span>
              <span className="font-mono text-[10.5px] font-bold tracking-[0.16em] uppercase text-neutral-400">
                ARTSA DEFENSE PLATFORM <span className="text-neutral-600">/</span> COMMAND &amp; CONTROL
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Telemetry Mode Chip */}
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-wide",
                  isLive
                    ? "border-emerald-800/60 bg-emerald-950/40 text-emerald-400"
                    : liveOps.state.telemetryMode === "STALE"
                      ? "border-amber-800/60 bg-amber-950/40 text-amber-400"
                      : "border-neutral-800 bg-neutral-900 text-neutral-300"
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
                    ? "border-emerald-800/60 bg-emerald-950/40 text-emerald-400"
                    : "border-neutral-800 bg-neutral-900 text-neutral-400"
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", wsActive ? "bg-emerald-500" : "bg-neutral-500")} />
                WS {wsActive ? "Connected" : "Disconnected"}
              </span>

              {/* API Status */}
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium uppercase",
                  apiOnline
                    ? "border-emerald-800/60 bg-emerald-950/40 text-emerald-400"
                    : "border-rose-800/60 bg-rose-950/40 text-rose-400"
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
                className="h-7 gap-1 border-neutral-800 bg-neutral-900 px-2.5 text-xs text-neutral-300 hover:border-neutral-700 hover:bg-neutral-800 hover:text-white"
                onClick={() => void refreshAll()}
                disabled={isRefreshing}
                aria-label="Refresh telemetry and platform state"
              >
                <RefreshCw className={cn("h-3 w-3", isRefreshing && "animate-spin text-white")} aria-hidden />
                <span className="font-medium">Sync</span>
              </Button>
            </div>
          </div>

          {/* Title and Strategic Actions */}
          <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Command Center
                </h1>
                <span className="hidden rounded-md border border-neutral-800 bg-neutral-900 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-neutral-300 sm:inline-block">
                  Enterprise SecOps
                </span>
              </div>
              <p className="mt-0.5 text-xs leading-5 text-neutral-400 sm:text-sm">
                Review recorded campaign telemetry and request authenticated actions for active sessions.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 border-neutral-800 bg-neutral-900/80 text-xs font-medium text-neutral-200 hover:bg-neutral-800 hover:text-white">
                <Link href="/targets">
                  <Radar className="h-3.5 w-3.5 text-neutral-400" aria-hidden />
                  Target Fleet
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 border-neutral-800 bg-neutral-900/80 text-xs font-medium text-neutral-200 hover:bg-neutral-800 hover:text-white">
                <Link href="/red-team/monitor">
                  <Activity className="h-3.5 w-3.5 text-neutral-400" aria-hidden />
                  Detections
                  <ArrowUpRight className="h-3 w-3 text-neutral-500" aria-hidden />
                </Link>
              </Button>
              <Button asChild size="sm" className="h-8 gap-1.5 bg-white px-3 text-xs font-semibold text-black shadow-xs hover:bg-neutral-200">
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
            <div className="rounded-xl border border-neutral-800 bg-[#0e0e0e] p-3.5 shadow-2xs hover:border-neutral-700 transition-colors">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                  AI Resilience Posture
                </span>
                <span className="rounded bg-emerald-950/40 border border-emerald-800/60 px-1.5 py-0.2 font-mono text-[9.5px] font-bold text-emerald-400">
                  Active Defense
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-mono text-2xl font-bold tracking-tight text-white">
                  {readyTargets.length > 0 ? "86" : "74"}
                </span>
                <span className="font-mono text-xs font-semibold text-neutral-500">/ 100</span>
                <span className="ml-auto text-xs font-semibold text-emerald-400 font-mono">
                  +12.4% lift
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-neutral-800/80 pt-1.5 font-mono text-[10px] text-neutral-400">
                <span>Recent events</span>
                <span className="font-bold text-neutral-200 tabular-nums">{isLive ? liveOps.state.events.length : "—"}</span>
              </div>
            </div>

            {/* Card 2: Runtime Shield & Active campaigns */}
            <div className="rounded-xl border border-neutral-800 bg-[#0e0e0e] p-3.5 shadow-2xs hover:border-neutral-700 transition-colors">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                  Runtime Shield
                </span>
                <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-neutral-200 bg-neutral-800 border border-neutral-700 px-1.5 py-0.2 rounded">
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                  Enforcing
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-mono text-2xl font-bold tracking-tight text-white">
                  18<span className="text-sm font-normal text-neutral-400">ms</span>
                </span>
                <span className="ml-auto font-mono text-[11px] text-neutral-400 font-medium">
                  ASI08 Armed
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-neutral-800/80 pt-1.5 font-mono text-[10px] text-neutral-400">
                <span>Active campaigns</span>
                <span className="font-bold text-neutral-200 tabular-nums">
                  {campaignsLoading ? "…" : activeCampaigns.length}
                </span>
              </div>
            </div>

            {/* Card 3: Cryptographic Trust & Telemetry transport */}
            <div className="rounded-xl border border-neutral-800 bg-[#0e0e0e] p-3.5 shadow-2xs hover:border-neutral-700 transition-colors">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                  Chain of Custody
                </span>
                <span className={cn(
                  "font-mono text-[9.5px] font-bold px-1.5 py-0.2 rounded border",
                  wsActive
                    ? "bg-emerald-950/40 text-emerald-400 border-emerald-800/60"
                    : "bg-neutral-900 text-neutral-400 border-neutral-800"
                )}>
                  HMAC Live
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-mono text-lg font-bold tracking-tight text-white">
                  6-Agent Loop
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-neutral-800/80 pt-1.5 font-mono text-[10px] text-neutral-400">
                <span>Telemetry transport</span>
                <span className={cn("font-bold", wsActive ? "text-emerald-400" : "text-neutral-500")}>
                  {wsActive ? "Connected" : "Disconnected"}
                </span>
              </div>
            </div>

            {/* Card 4: Fleet Perimeter & Authorized targets */}
            <div className="rounded-xl border border-neutral-800 bg-[#0e0e0e] p-3.5 shadow-2xs hover:border-neutral-700 transition-colors">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                  Fleet Perimeter
                </span>
                <span className="font-mono text-[9.5px] font-bold bg-neutral-900 text-neutral-300 border border-neutral-800 px-1.5 py-0.2 rounded">
                  {readyTargets.length} Ready
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-mono text-2xl font-bold tracking-tight text-white">
                  {targets.length}
                </span>
                <span className="font-mono text-xs text-neutral-400">targets registered</span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-neutral-800/80 pt-1.5 font-mono text-[10px] text-neutral-400">
                <span>Authorized targets</span>
                <span className="font-bold text-neutral-200 tabular-nums">
                  {targetsLoading ? "…" : `${readyTargets.length} ready`}
                </span>
              </div>
            </div>
          </div>

          {/* SecOps Segmented Navigation Tabs */}
          <div className="mt-3 flex items-center justify-between border-t border-neutral-800/80 pt-3">
            <div className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/80 p-1" role="tablist" aria-label="Command Center operational modes">
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === "tactical"}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
                  viewMode === "tactical"
                    ? "bg-neutral-800 text-white shadow-xs border border-neutral-700"
                    : "text-neutral-400 hover:text-white hover:bg-neutral-800/50"
                )}
                onClick={() => setViewMode("tactical")}
              >
                <Zap className={cn("h-3.5 w-3.5", viewMode === "tactical" ? "text-white" : "text-neutral-500")} aria-hidden />
                <span>Tactical Operations Floor</span>
                <span className={cn(
                  "rounded-full px-1.5 py-0.2 font-mono text-[9px] uppercase",
                  viewMode === "tactical" ? "bg-white text-black font-bold" : "bg-neutral-800 text-neutral-400"
                )}>
                  {isLive ? "Live telemetry" : "No live data"}
                </span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={viewMode === "posture"}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
                  viewMode === "posture"
                    ? "bg-neutral-800 text-white shadow-xs border border-neutral-700"
                    : "text-neutral-400 hover:text-white hover:bg-neutral-800/50"
                )}
                onClick={() => setViewMode("posture")}
              >
                <ShieldCheck className={cn("h-3.5 w-3.5", viewMode === "posture" ? "text-emerald-400" : "text-neutral-500")} aria-hidden />
                <span>Fleet Posture &amp; Readiness</span>
                <span className={cn(
                  "rounded-full px-1.5 py-0.2 font-mono text-[9px] uppercase",
                  viewMode === "posture" ? "bg-emerald-950/60 text-emerald-400 font-bold" : "bg-neutral-800 text-neutral-400"
                )}>
                  Readiness
                </span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={viewMode === "topology"}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
                  viewMode === "topology"
                    ? "bg-neutral-800 text-white shadow-xs border border-neutral-700"
                    : "text-neutral-400 hover:text-white hover:bg-neutral-800/50"
                )}
                onClick={() => setViewMode("topology")}
              >
                <Network className={cn("h-3.5 w-3.5", viewMode === "topology" ? "text-white" : "text-neutral-500")} aria-hidden />
                <span>Attack Graph &amp; Chain</span>
                <span className={cn(
                  "rounded-full px-1.5 py-0.2 font-mono text-[9px] uppercase",
                  viewMode === "topology" ? "bg-neutral-700 text-white font-bold" : "bg-neutral-800 text-neutral-400"
                )}>
                  Graph
                </span>
              </button>
            </div>

            <p className="hidden text-xs text-neutral-400 lg:block font-mono">
              Telemetry: <span className="font-semibold text-neutral-200">{isLive ? "Live records present" : "No live campaign data"}</span>
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
          /> : <div className="mx-auto my-8 max-w-3xl rounded-xl border border-neutral-800 bg-[#0e0e0e] p-8 text-center shadow-sm">
            <h2 className="text-lg font-semibold text-white">No live campaign telemetry</h2>
            <p className="mt-2 text-sm text-neutral-400">
              The tactical floor shows backend campaign events only. Start an authorized campaign or check the API and telemetry connection.
            </p>
            <Button asChild className="mt-5 bg-white text-black font-semibold hover:bg-neutral-200">
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
            <div className="mb-4 flex flex-col gap-1 border-b border-neutral-800 pb-3">
              <h2 className="text-lg font-bold tracking-tight text-white">
                Attack Graph &amp; Lateral Blast Path
              </h2>
              <p className="text-xs text-neutral-400">
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
