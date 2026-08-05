"use client";

import { useCallback, useEffect, useState } from "react";
import { Layers, RefreshCw, ShieldAlert } from "lucide-react";
import GuardrailPenetrationXRay from "@/components/GuardrailPenetrationXRay";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageLoadingSkeleton } from "@/components/shared/PageSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchFromBackend } from "@/lib/api";

interface DashboardMetrics {
  severity_counts: Record<string, number>;
  defense_layers: Record<string, number>;
  defense_score: number;
  risk_trend: Array<{ timestamp: string; risk_score: number; tool_name?: string }>;
  avg_risk_score: number;
  max_risk_score: number;
  active_sessions: number;
}

interface ObservatoryData {
  total_rounds: number;
  regression_suite: {
    gates: Array<{ name: string; status: string; severity: string; value: number }>;
    passing: number;
    total: number;
  };
}

/**
 * Derive guardrail bypass depth from live telemetry:
 * - Severity counts drive the primary estimate (a CRITICAL event implies the
 *   deepest guardrail penetration; no events implies a clean stack).
 * - Failing CI regression gates push the depth further, since a failing
 *   guardrail gate means a defense layer is not holding.
 */
function deriveBypassDepth(metrics: DashboardMetrics | null, observatory: ObservatoryData | null): number {
  const counts = metrics?.severity_counts ?? {};
  const severityDepth =
    counts.CRITICAL > 0 ? 4 : counts.HIGH > 0 ? 3 : counts.MEDIUM > 0 ? 2 : counts.LOW > 0 ? 1 : 0;
  const failingGates = observatory?.regression_suite?.gates.filter((g) => g.status !== "PASSING").length ?? 0;
  return Math.max(severityDepth, Math.min(failingGates, 4));
}

export default function XRayPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [observatory, setObservatory] = useState<ObservatoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreachable, setUnreachable] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setUnreachable(false);
    const [m, o] = await Promise.all([
      fetchFromBackend<DashboardMetrics>("/api/v1/metrics/dashboard", { silent: true }),
      fetchFromBackend<ObservatoryData>("/api/v1/observatory", { silent: true }),
    ]);
    setMetrics(m);
    setObservatory(o);
    setUnreachable(m === null && o === null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <PageLoadingSkeleton />;
  }

  const bypassDepth = deriveBypassDepth(metrics, observatory);
  const severityCounts = metrics?.severity_counts ?? {};
  const failingGates =
    observatory?.regression_suite?.gates.filter((g) => g.status !== "PASSING").length ?? 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Defense X-Ray"
        description="Layer-by-layer guardrail penetration analysis — blocked prompt injections, tool misuse events, and policy violations mapped to bypass depth."
        icon={<Layers className="h-5 w-5" />}
        actions={
          <Button variant="outline" size="sm" className="gap-2" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            Refresh
          </Button>
        }
      />

      {unreachable ? (
        <EmptyState
          icon={ShieldAlert}
          title="Unable to load X-Ray data"
          description="The metrics and observatory endpoints are unreachable. Ensure the backend API is running on port 8000."
          action={
            <Button size="sm" onClick={() => void load()}>
              Retry
            </Button>
          }
        />
      ) : (
        <>
          <GuardrailPenetrationXRay bypassDepth={bypassDepth} />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Live source:</span>
            <Badge variant="outline" className="font-mono text-[10px]">
              CRIT {severityCounts.CRITICAL ?? 0} · HIGH {severityCounts.HIGH ?? 0} · MED{" "}
              {severityCounts.MEDIUM ?? 0} · LOW {severityCounts.LOW ?? 0}
            </Badge>
            <Badge variant={failingGates > 0 ? "warning" : "success"} className="font-mono text-[10px]">
              {failingGates} failing gate{failingGates === 1 ? "" : "s"}
            </Badge>
            {observatory && (
              <Badge variant="secondary" className="font-mono text-[10px]">
                {observatory.total_rounds} rounds
              </Badge>
            )}
          </div>
        </>
      )}
    </div>
  );
}
