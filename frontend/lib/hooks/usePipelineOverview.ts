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
  const { apiOnline } = useConnection();

  const activeSessions = clampSessionCount(metrics?.active_sessions);
  const kpis = deriveCommandCenterKpis(metrics, liveEvents, playbookVersion || policyRules.length, campaigns);

  const pipeline = derivePipelineSnapshot({
    apiOnline,
    activeSessions,
    campaigns,
  });

  return {
    kpis,
    pipeline,
    loading: metricsLoading || campaignsLoading,
    refreshPolicies,
  };
}
