"use client";

import { useAppData } from "@/lib/context/AppDataProvider";
import { deriveCommandCenterKpis } from "@/lib/commandCenterKpis";
import { derivePipelineSnapshot } from "@/lib/pipelineState";
import { useDashboardMetrics } from "@/lib/hooks/useDashboardMetrics";
import { useConnection } from "@/lib/context/ConnectionProvider";
import { clampSessionCount } from "@/lib/connectionStatus";

/** Shared live signals for Command Center KPIs and Agent Pipeline screens. */
export function usePipelineOverview() {
  const { metrics, liveEvents, loading: metricsLoading } = useDashboardMetrics();
  const {
    campaigns,
    campaignsLoading,
    playbookVersion,
    policyRules,
    refreshPolicies,
  } = useAppData();
  const { apiOnline, wsConnected } = useConnection();

  const activeSessions = clampSessionCount(metrics?.active_sessions);
  const counts = metrics?.severity_counts ?? {};
  const playbookRuleCount = policyRules.length || playbookVersion;

  const kpis = deriveCommandCenterKpis(metrics, liveEvents, playbookVersion || policyRules.length, campaigns);

  const pipeline = derivePipelineSnapshot({
    apiOnline,
    wsConnected,
    activeSessions,
    defenseScore: metrics?.defense_score ?? 0,
    criticalCount: Number(counts.CRITICAL ?? 0),
    highCount: Number(counts.HIGH ?? 0),
    campaigns,
    playbookRuleCount,
  });

  return {
    kpis,
    pipeline,
    loading: metricsLoading || campaignsLoading,
    refreshPolicies,
  };
}
