"use client";

import { useState } from "react";
import { ShieldAlert, Activity, ShieldCheck, ChevronDown } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { DashboardCard } from "@/components/shared/DashboardCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { ThreatMatrix } from "@/components/shared/ThreatMatrix";
import { RiskTrendChart } from "@/components/charts/RiskTrendChart";
import { StatCardsSkeleton, ChartSkeleton } from "@/components/shared/PageSkeleton";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDashboardMetrics } from "@/lib/hooks/useDashboardMetrics";
import { useConnection } from "@/lib/context/ConnectionProvider";
import { clampSessionCount } from "@/lib/connectionStatus";
import { cn } from "@/lib/utils";

const LAYER_LABELS: Record<string, string> = {
  tool_validator: "Layer 1 · Tool Validator",
  statistical_inspector: "Layer 2 · Statistical Inspector",
  goal_drift_classifier: "Layer 3 · Goal Drift",
  containment_enforcer: "Layer 4 · Containment Enforcer",
};

export default function CommandCenter() {
  const { metrics, liveEvents, loading } = useDashboardMetrics();
  const { apiOnline, wsConnected, apiGatewayStatus } = useConnection();
  const activeSessions = clampSessionCount(metrics?.active_sessions);
  const [defenseOpen, setDefenseOpen] = useState(false);

  const counts = metrics?.severity_counts ?? { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  const chartData = (metrics?.risk_trend ?? []).map((p, i) => ({
    name: i + 1,
    score: p.risk_score,
  }));
  const streamItems = liveEvents.length ? liveEvents.slice(-12) : [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Command Center"
        description="Real-time tool call inspection, escape risk monitoring, and containment enforcement."
        icon={<ShieldAlert className="h-5 w-5" />}
      />

      {loading ? (
        <StatCardsSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Critical Breaches" value={counts.CRITICAL ?? 0} severity="CRITICAL" />
          <StatCard label="High Anomalies" value={counts.HIGH ?? 0} severity="HIGH" />
          <StatCard label="Medium Risks" value={counts.MEDIUM ?? 0} severity="MEDIUM" />
          <StatCard label="Low Intent Drift" value={counts.LOW ?? 0} severity="LOW" />
        </div>
      )}

      <DashboardCard
        title="Risk Trend"
        description={`${activeSessions} active session${activeSessions === 1 ? "" : "s"}`}
        className="w-full"
        delay={0.05}
        contentClassName="space-y-4"
      >
        {loading ? (
          <ChartSkeleton />
        ) : chartData.length > 0 ? (
          <RiskTrendChart data={chartData} />
        ) : (
          <EmptyState
            icon={Activity}
            title="No risk data yet"
            description="Ingest tool calls via POST /api/v1/ingest to populate the risk trend."
            action={
              <Button asChild size="sm" variant="outline">
                <Link href="/wargame">Launch wargame</Link>
              </Button>
            }
            className="py-12"
          />
        )}
        {!loading && chartData.length > 0 && (
          <div className="flex gap-4 font-mono text-[11px] text-muted-foreground">
            <span>Avg: {metrics?.avg_risk_score ?? "—"}</span>
            <span>Max: {metrics?.max_risk_score ?? "—"}</span>
          </div>
        )}
      </DashboardCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DashboardCard
          title="Live Telemetry Stream"
          description="Real-time events from WebSocket feed"
          delay={0.1}
          contentClassName="space-y-0"
        >
          <ScrollArea className="h-64 rounded-lg border border-border bg-muted/20">
            <div className="space-y-0 p-2" aria-live="polite" aria-label="Live telemetry events">
              {loading ? (
                <div className="space-y-2 p-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-8 animate-pulse rounded bg-muted" />
                  ))}
                </div>
              ) : streamItems.length === 0 ? (
                <EmptyState
                  icon={Activity}
                  title="Awaiting telemetry"
                  description="Events appear here when the ingest pipeline is active."
                  className="border-0 bg-transparent py-8"
                />
              ) : (
                streamItems.map((evt, i) => {
                  const score = Number((evt as Record<string, unknown>).risk_score ?? 0);
                  const tool = String((evt as Record<string, unknown>).tool_name ?? "event");
                  const verdict = String((evt as Record<string, unknown>).verdict ?? "");
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between border-b border-border/50 px-2 py-2 font-mono text-xs last:border-0"
                    >
                      <span className="truncate text-muted-foreground">{tool}</span>
                      <span
                        className={cn(
                          "shrink-0 tabular-nums",
                          score >= 80 ? "text-severity-critical" : score >= 50 ? "text-severity-medium" : "text-severity-low"
                        )}
                      >
                        {score || "—"} {verdict && `/ ${verdict}`}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </DashboardCard>

        <ThreatMatrix />
      </div>

      <DashboardCard title="Defense Depth" delay={0.15} contentClassName="p-0">
        <button
          type="button"
          className="flex w-full items-center justify-between px-6 py-4 text-left"
          onClick={() => setDefenseOpen((v) => !v)}
          aria-expanded={defenseOpen}
        >
          <div>
            <p className="text-sm font-medium">Multi-layer containment posture</p>
            <p className="text-xs text-muted-foreground">Click to expand layer breakdown</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="success" className="font-mono">
              {metrics?.defense_score?.toFixed(1) ?? "—"}%
            </Badge>
            <ChevronDown
              className={cn("h-4 w-4 text-muted-foreground transition-transform", defenseOpen && "rotate-180")}
            />
          </div>
        </button>
        {defenseOpen && metrics?.defense_layers && (
          <div className="space-y-4 border-t border-border px-6 pb-6 pt-4">
            {Object.entries(metrics.defense_layers).map(([key, val]) => (
              <div key={key} className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{LAYER_LABELS[key] ?? key}</span>
                  <span className="font-mono text-emerald-400">{val}%</span>
                </div>
                <Progress value={val} className="h-1.5" aria-label={`${key} at ${val}%`} />
              </div>
            ))}
          </div>
        )}
      </DashboardCard>

      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        <ShieldCheck className="h-4 w-4 text-emerald-400" aria-hidden />
        <span>
          {apiOnline
            ? apiGatewayStatus === "fully_connected"
              ? "Unified API fully connected"
              : "Containment engine operational"
            : "Backend offline — start API on port 8000"}
        </span>
        {apiOnline && (
          <>
            <span className="hidden sm:inline">·</span>
            <span className="font-mono text-xs">Telemetry {wsConnected ? "stream" : "polling"}</span>
          </>
        )}
      </div>
    </div>
  );
}
