"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Activity, BarChart3, Download, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { DashboardCard } from "@/components/shared/DashboardCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { ThreatMatrix } from "@/components/shared/ThreatMatrix";
import { RiskTrendChart } from "@/components/charts/RiskTrendChart";
import { StatCardsSkeleton, ChartSkeleton } from "@/components/shared/PageSkeleton";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDashboardMetrics } from "@/lib/hooks/useDashboardMetrics";
import { clampSessionCount } from "@/lib/connectionStatus";
import { deriveIncidentKpis } from "@/lib/incidentKpis";
import { severityFromScore } from "@/lib/severity";
import { PageStack } from "@/components/shared/PageStack";
import { LAYER_LABELS } from "@/lib/layerLabels";
import { EMPTY_STATE_UI } from "@/lib/getStartedLabels";
import dynamic from "next/dynamic";
import { DetectionRateChart } from "@/components/charts/DetectionRateChart";
import {
  buildDetectionSeries,
  detectionSeriesToCsv,
  downloadTextFile,
} from "@/lib/detectionAnalytics";

const ObservatoryPanel = dynamic(() => import("@/components/ObservatoryPanel"), { ssr: false });
const XRayPanel = dynamic(() => import("@/components/XRayPanel"), { ssr: false });

export default function AnalyticsPage() {
  const { metrics, liveEvents, loading } = useDashboardMetrics();
  const activeSessions = clampSessionCount(metrics?.active_sessions);
  const counts = metrics?.severity_counts ?? { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  const chartData = (metrics?.risk_trend ?? []).map((p, i) => ({
    name: i + 1,
    score: p.risk_score,
  }));
  const kpis = deriveIncidentKpis(metrics, liveEvents);
  const providerRisk = Number.isFinite(kpis.provider_risk_score) ? kpis.provider_risk_score : 0;
  const detectionSeries = useMemo(
    () => buildDetectionSeries(metrics?.risk_trend, metrics?.defense_score),
    [metrics?.risk_trend, metrics?.defense_score]
  );

  const exportDetectionCsv = () => {
    if (!detectionSeries.length) return;
    downloadTextFile(
      `artsa-detection-rate-${new Date().toISOString().slice(0, 10)}.csv`,
      detectionSeriesToCsv(detectionSeries)
    );
  };

  return (
    <PageStack>
      <PageHeader
        title="Analytics"
        description="Risk trends, defense depth, observatory regression metrics, and X-Ray bypass analysis."
        icon={<BarChart3 className="h-5 w-5" />}
      />

      {loading ? (
        <StatCardsSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Critical" value={counts.CRITICAL ?? 0} severity="CRITICAL" />
          <StatCard label="High" value={counts.HIGH ?? 0} severity="HIGH" />
          <StatCard label="Medium" value={counts.MEDIUM ?? 0} severity="MEDIUM" />
          <StatCard
            label="Provider risk"
            value={providerRisk}
            severity={severityFromScore(providerRisk)}
            subtitle="Aggregate posture"
          />
        </div>
      )}

      <DashboardCard
        title="Detection rate vs static baseline"
        description="ARTSA self-updating detection rate compared to a fixed 62% static baseline — export for defense slides."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="interactive-pill gap-2"
            disabled={detectionSeries.length === 0}
            onClick={exportDetectionCsv}
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        }
        contentClassName="space-y-4"
      >
        {loading ? (
          <ChartSkeleton />
        ) : detectionSeries.length > 0 ? (
          <DetectionRateChart data={detectionSeries} />
        ) : (
          <EmptyState
            icon={BarChart3}
            title="No detection trend yet"
            description="Ingest agent traffic or complete a campaign to plot live detection rate against the static baseline."
            action={
              <Button asChild size="sm" variant="outline">
                <Link href="/get-started">{EMPTY_STATE_UI.openSetup}</Link>
              </Button>
            }
            className="py-12"
          />
        )}
      </DashboardCard>

      <DashboardCard
        title="Risk trend"
        description={`${activeSessions} active session${activeSessions === 1 ? "" : "s"}`}
        contentClassName="space-y-4"
      >
        {loading ? (
          <ChartSkeleton />
        ) : chartData.length > 0 ? (
          <>
            <RiskTrendChart data={chartData} />
            <div className="flex gap-4 font-mono text-[11px] text-muted-foreground">
              <span>Avg: {metrics?.avg_risk_score ?? "—"}</span>
              <span>Max: {metrics?.max_risk_score ?? "—"}</span>
            </div>
          </>
        ) : (
          <EmptyState
            icon={Activity}
            title={EMPTY_STATE_UI.noAnalyticsTitle}
            description={EMPTY_STATE_UI.noAnalyticsDescription}
            action={
              <Button asChild size="sm">
                <Link href="/get-started">{EMPTY_STATE_UI.openSetup}</Link>
              </Button>
            }
            variant="hero"
            className="min-h-[280px] shadow-none"
          />
        )}
      </DashboardCard>

      <ThreatMatrix />

      <DashboardCard title="Defense depth" description="Multi-layer containment effectiveness">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Overall defense score</span>
            <Badge variant="outline" className="meta-badge font-mono">
              {metrics?.defense_score?.toFixed(1) ?? "—"}%
            </Badge>
          </div>
          <div className="space-y-4">
            {Object.entries(metrics?.defense_layers ?? {}).map(([key, val]) => (
              <div key={key} className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{LAYER_LABELS[key] ?? key}</span>
                  <span className="font-mono text-status-success">{val}%</span>
                </div>
                <Progress value={val} className="h-1.5" aria-label={`${key} at ${val}%`} />
              </div>
            ))}
            {Object.keys(metrics?.defense_layers ?? {}).length === 0 && (
              <p className="text-xs text-muted-foreground">Send agent activity to see layer-by-layer scores.</p>
            )}
          </div>
        </DashboardCard>

      <DashboardCard
        title="Continuous observatory"
        description="Regression gates, co-evolution metrics, and detector ablation"
        badge={<ShieldCheck className="h-4 w-4 text-muted-foreground" aria-hidden />}
      >
        <ObservatoryPanel />
      </DashboardCard>

      <XRayPanel />
    </PageStack>
  );
}
