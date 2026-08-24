"use client";

import Link from "next/link";
import { ArrowRight, Download, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { DashboardCard } from "@/components/shared/DashboardCard";
import {
  computeReadinessFromMilestones,
  READINESS_PHASE_META,
} from "@/lib/readinessFlow";
import { loadWargameReadinessRecords } from "@/lib/campaignReadiness";
import { useConnection } from "@/lib/context/ConnectionProvider";
import { useMemo } from "react";

/** Go-live readiness snapshot for Reports / Settings — milestones + wargame appendix status. */
export function ReadinessSnapshotPanel({ hasTraffic = false }: { hasTraffic?: boolean }) {
  const { apiOnline, wsConnected } = useConnection();
  const flow = useMemo(
    () =>
      computeReadinessFromMilestones({
        apiOnline,
        wsConnected,
        hasTraffic,
      }),
    [apiOnline, wsConnected, hasTraffic]
  );
  const wargameCount = loadWargameReadinessRecords().length;
  const phaseMeta = READINESS_PHASE_META[flow.phase === "complete" ? "complete" : flow.phase];

  return (
    <DashboardCard
      title="Go-live readiness"
      description="Suite tests, connection setup, and wargame results for your compliance export."
      contentClassName="space-y-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-3xl font-semibold tabular-nums">{flow.score}%</span>
            <Badge variant={flow.productionReady ? "outline" : "secondary"} className="text-[10px]">
              {flow.productionReady ? "Production ready" : phaseMeta.title}
            </Badge>
            {wargameCount > 0 && (
              <Badge variant="outline" className="text-[10px]">
                {wargameCount} wargame{wargameCount === 1 ? "" : "s"} in export
              </Badge>
            )}
          </div>
          <Progress value={flow.score} className="mt-3 h-2 max-w-md" />
          {flow.blockers.length > 0 && !flow.productionReady && (
            <p className="mt-2 text-xs text-muted-foreground">{flow.blockers[0]}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={flow.nextAction.href}>
              <Rocket className="h-3.5 w-3.5" />
              {flow.nextAction.label}
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/get-started">
              <Download className="h-3.5 w-3.5" />
              Export readiness
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </DashboardCard>
  );
}
