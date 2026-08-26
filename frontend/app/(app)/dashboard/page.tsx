"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ShieldAlert,
  Activity,
  ShieldCheck,
  Crosshair,
  ScrollText,
  GitBranch,
  Shield,
  Clock,
  BookMarked,
  Network,
} from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { DashboardCard } from "@/components/shared/DashboardCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { LiveTelemetryStream } from "@/components/shared/LiveTelemetryStream";
import { LiveIndicator } from "@/components/shared/LiveIndicator";
import { ThreatMatrix } from "@/components/shared/ThreatMatrix";
import { RiskTrendChart } from "@/components/charts/RiskTrendChart";
import { StatCardsSkeleton, ChartSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";
import { useDashboardMetrics } from "@/lib/hooks/useDashboardMetrics";
import { useCommandCenterActivity } from "@/lib/hooks/useCommandCenterActivity";
import { fetchFromBackend } from "@/lib/api";
import { useConnection } from "@/lib/context/ConnectionProvider";
import { clampSessionCount } from "@/lib/connectionStatus";
import { IntegrationActivityPanel } from "@/components/dashboard/IntegrationActivityPanel";
import { SetupProgressBanner } from "@/components/dashboard/SetupProgressBanner";
import { PageStack } from "@/components/shared/PageStack";
import { computeReadinessFromMilestones } from "@/lib/readinessFlow";
import { COMMAND_CENTER_UI, COACHMARK_UI, EMPTY_STATE_UI } from "@/lib/getStartedLabels";
import { FirstTrafficCoachmark } from "@/components/dashboard/FirstTrafficCoachmark";
import { ingestResponseToTelemetry } from "@/lib/ingestTelemetry";
import { toast } from "@/lib/stores/toast";
import { AgentStatusStrip } from "@/components/pipeline/AgentStatusStrip";
import { CommandGraphPanel } from "@/components/command/CommandGraphPanel";
import { usePipelineOverview } from "@/lib/hooks/usePipelineOverview";

const COACHMARK_DISMISS_KEY = "artsa-first-traffic-coachmark-dismiss";
const AUTO_INGEST_KEY = "artsa-dashboard-auto-ingest";

export default function CommandCenter() {
  const { metrics, liveEvents, loading, refreshMetrics, appendLiveEvent } = useDashboardMetrics();
  const { apiOnline, wsConnected, apiGatewayStatus } = useConnection();
  const {
    displayEvents,
    hydrating,
    integrationStatus,
    outboundConnected,
    usingHydrated,
    integrationStatusLoading,
  } = useCommandCenterActivity(liveEvents, apiOnline);
  const { kpis, pipeline, loading: pipelineLoading } = usePipelineOverview();
  const activeSessions = clampSessionCount(metrics?.active_sessions);
  const [coachmarkDismissed, setCoachmarkDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(COACHMARK_DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });
  const autoIngestAttempted = useRef(false);
  const [ingestTestLoading, setIngestTestLoading] = useState(false);
  const [ingestTestMessage, setIngestTestMessage] = useState<string | null>(null);
  const [ingestTestOk, setIngestTestOk] = useState<boolean | null>(null);

  const runIngestTest = useCallback(async (): Promise<boolean> => {
    setIngestTestLoading(true);
    setIngestTestMessage(null);
    setIngestTestOk(null);
    const sessionId = crypto.randomUUID();
    const request = {
      session_id: sessionId,
      agent_id: "artsa-dashboard-test",
      tool_name: "read_file",
      arguments: { path: "/etc/passwd" },
    };
    const data = await fetchFromBackend<{
      session_id?: string;
      agent_id?: string;
      tool_name?: string;
      risk_score?: { overall_score?: number };
      verdict?: { verdict?: string; recommended_action?: string };
    }>("/api/v1/ingest", {
      method: "POST",
      body: JSON.stringify(request),
    });
    setIngestTestLoading(false);
    if (data) {
      setIngestTestOk(true);
      setIngestTestMessage(COMMAND_CENTER_UI.testIngestOk);
      appendLiveEvent(ingestResponseToTelemetry(request, data));
      void refreshMetrics();
      return true;
    }
    setIngestTestOk(false);
    setIngestTestMessage(COMMAND_CENTER_UI.testIngestFailed);
    return false;
  }, [refreshMetrics, appendLiveEvent]);

  const hasTraffic =
    displayEvents.length > 0 || (metrics?.total_events ?? 0) > 0;

  const showCoachmark =
    apiOnline &&
    !coachmarkDismissed &&
    !hasTraffic &&
    !loading &&
    !hydrating &&
    !integrationStatusLoading;

  useEffect(() => {
    if (
      autoIngestAttempted.current ||
      !apiOnline ||
      integrationStatusLoading ||
      loading ||
      hydrating
    ) {
      return;
    }
    if (hasTraffic) return;
    if (!integrationStatus.ingestKeyConfigured) return;

    try {
      if (sessionStorage.getItem(AUTO_INGEST_KEY)) return;
      sessionStorage.setItem(AUTO_INGEST_KEY, "1");
    } catch {
      return;
    }

    autoIngestAttempted.current = true;
    void (async () => {
      const ok = await runIngestTest();
      if (ok) {
        toast(COACHMARK_UI.autoIngestOk, { variant: "success" });
        setCoachmarkDismissed(true);
      } else {
        toast(COACHMARK_UI.autoIngestFailed, { variant: "warning" });
      }
    })();
  }, [
    apiOnline,
    integrationStatusLoading,
    integrationStatus.ingestKeyConfigured,
    loading,
    hydrating,
    hasTraffic,
    runIngestTest,
  ]);

  const dismissCoachmark = () => {
    setCoachmarkDismissed(true);
    try {
      sessionStorage.setItem(COACHMARK_DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const counts = metrics?.severity_counts ?? { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  const chartData = (metrics?.risk_trend ?? []).map((p, i) => ({
    name: i + 1,
    score: p.risk_score,
  }));
  const trendData = chartData;

  const setupFlow = useMemo(
    () =>
      computeReadinessFromMilestones({
        apiOnline,
        wsConnected,
        hasTraffic: displayEvents.length > 0 || (metrics?.total_events ?? 0) > 0,
      }),
    [apiOnline, wsConnected, displayEvents.length, metrics?.total_events]
  );

  return (
    <PageStack>
      <PageHeader
        title="Command Center"
        description={COMMAND_CENTER_UI.pageDescription}
        icon={<ShieldAlert className="h-5 w-5" />}
        badge={<LiveIndicator connected={apiOnline && wsConnected} className="meta-badge" />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/get-started">Get Started</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/sandbox">
                <Crosshair className="h-3.5 w-3.5" />
                Scan payload
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/logs">
                <ScrollText className="h-3.5 w-3.5" />
                Activity log
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/pipeline">
                <GitBranch className="h-3.5 w-3.5" />
                Pipeline
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/topology">
                <Network className="h-3.5 w-3.5" />
                Topology
              </Link>
            </Button>
          </div>
        }
      />

      <SetupProgressBanner flow={setupFlow} />

      {showCoachmark && (
        <FirstTrafficCoachmark
          onTestIngest={() => void runIngestTest()}
          testLoading={ingestTestLoading}
          onDismiss={dismissCoachmark}
        />
      )}

      <IntegrationActivityPanel
        events={displayEvents}
        loading={loading || hydrating}
        apiOnline={apiOnline}
        wsConnected={wsConnected}
        totalEvents={metrics?.total_events ?? 0}
        activeSessions={activeSessions}
        outboundConnected={outboundConnected}
        integrationStatus={integrationStatus}
        usingHydrated={usingHydrated}
        onTestIngest={() => void runIngestTest()}
        ingestTestLoading={ingestTestLoading}
        ingestTestMessage={ingestTestMessage}
        ingestTestOk={ingestTestOk}
      />

      {/* Primary ops surface — Palantir-style mission graph */}
      <CommandGraphPanel
        events={displayEvents}
        apiOnline={apiOnline}
      />

      {loading || pipelineLoading ? (
        <StatCardsSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Threats blocked"
            value={kpis.threatsBlocked}
            icon={Shield}
            subtitle="Containment actions"
            sparklineData={kpis.detectionSparkline}
            sparklineVariant="success"
            href="/logs"
          />
          <StatCard
            label="Pending triage"
            value={kpis.pendingTriage}
            severity={kpis.pendingTriage > 0 ? "HIGH" : undefined}
            icon={ShieldAlert}
            subtitle="Critical + high findings"
            href="/logs"
          />
          <StatCard
            label="Playbook version"
            value={kpis.playbookVersion}
            icon={BookMarked}
            subtitle="Org policy rules"
            href="/admin/policies"
          />
          <StatCard
            label="Last scan"
            value={kpis.lastScanLabel}
            icon={Clock}
            subtitle="Campaign or ingest activity"
            href="/campaigns"
          />
        </div>
      )}

      {!loading && !pipelineLoading && (
        <DashboardCard
          title="Agent pipeline"
          description="Six-role closed loop — live status at a glance"
          actions={
            <Button asChild variant="outline" size="sm" className="interactive-pill">
              <Link href="/pipeline">Open pipeline</Link>
            </Button>
          }
          contentClassName="pt-1"
        >
          <AgentStatusStrip agents={pipeline.agents} compact />
        </DashboardCard>
      )}

      {!loading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Critical"
            value={counts.CRITICAL ?? 0}
            severity="CRITICAL"
            variant="compact"
            href="/logs"
          />
          <StatCard
            label="High"
            value={counts.HIGH ?? 0}
            severity="HIGH"
            variant="compact"
            href="/logs"
          />
          <StatCard
            label="Medium"
            value={counts.MEDIUM ?? 0}
            severity="MEDIUM"
            variant="compact"
            href="/analytics"
          />
          <StatCard
            label="Low"
            value={counts.LOW ?? 0}
            severity="LOW"
            variant="compact"
            href="/analytics"
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ThreatMatrix />

        <DashboardCard
          title="Risk Trend"
          description={`${activeSessions} active session${activeSessions === 1 ? "" : "s"}`}
          contentClassName="space-y-4"
        >
        {loading ? (
          <ChartSkeleton />
        ) : trendData.length > 0 ? (
          <RiskTrendChart data={trendData} />
        ) : (
          <EmptyState
            icon={Activity}
            title={EMPTY_STATE_UI.noRiskTrendTitle}
            description={EMPTY_STATE_UI.noRiskTrendDescription}
            action={
              <Button asChild size="sm" variant="outline">
                <Link href="/get-started">{EMPTY_STATE_UI.openSetup}</Link>
              </Button>
            }
            className="py-12"
          />
        )}
        {!loading && trendData.length > 0 && (
          <div className="flex gap-4 font-mono text-[11px] text-muted-foreground">
            <span>Avg: {metrics?.avg_risk_score ?? "—"}</span>
            <span>Max: {metrics?.max_risk_score ?? "—"}</span>
          </div>
        )}
        </DashboardCard>
      </div>

      <DashboardCard
        title="Live stream"
        description="Recent screened events — select a row for session replay"
        contentClassName="space-y-0"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/logs">{COMMAND_CENTER_UI.viewFullLog}</Link>
          </Button>
        }
      >
        <LiveTelemetryStream
          events={displayEvents.slice(-20)}
          loading={loading}
          height="h-56"
          emptyAction={
            <Button asChild size="sm">
              <Link href="/get-started">{COMMAND_CENTER_UI.getStarted}</Link>
            </Button>
          }
        />
      </DashboardCard>

      <div className="callout-bar flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Defense layers, observatory regression, and X-Ray bypass depth
        </p>
        <Button asChild variant="outline" size="sm" className="interactive-pill">
          <Link href="/analytics">Open Analytics</Link>
        </Button>
      </div>

      <div className="callout-bar flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <ShieldCheck className="h-4 w-4 text-foreground" aria-hidden />
        <span>
          {apiOnline
            ? apiGatewayStatus === "fully_connected"
              ? "Unified API fully connected"
              : "Containment engine operational"
            : "ARTSA API offline — check your deployment"}
        </span>
        {apiOnline && (
          <>
            <span className="hidden sm:inline">·</span>
            <span className="font-mono text-xs">Telemetry {wsConnected ? "stream" : "polling"}</span>
          </>
        )}
      </div>
    </PageStack>
  );
}
