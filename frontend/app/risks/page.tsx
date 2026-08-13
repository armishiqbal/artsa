"use client";

import Link from "next/link";
import { ShieldAlert, Activity, Ban, Gauge, Layers, Radar, AlertTriangle } from "lucide-react";
import {
  CATEGORY_LABELS,
  DEFENSE_LAYER_COUNT,
  DEFENSE_LAYER_LABELS,
} from "@/lib/agenticRisks";
import type { AgenticRisk } from "@/lib/types";
import { useRiskFramework } from "@/lib/hooks/useRiskFramework";
import { PageHeader } from "@/components/shared/PageHeader";
import { DashboardCard } from "@/components/shared/DashboardCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageLoadingSkeleton } from "@/components/shared/PageSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

function severityVariant(severity: AgenticRisk["severity"]) {
  return severity === "CRITICAL"
    ? "critical"
    : severity === "HIGH"
      ? "warning"
      : severity === "MEDIUM"
        ? "secondary"
        : "success";
}

function RiskCard({ risk }: { risk: AgenticRisk }) {
  const primaryCategory = risk.attack_categories[0];

  return (
    <DashboardCard
      title={`#${risk.rank} · ${risk.name}`}
      badge={
        <Badge variant={severityVariant(risk.severity)} className="font-mono text-[10px] uppercase">
          {risk.severity}
        </Badge>
      }
      delay={0.02 * risk.rank}
    >
      <p className="text-xs leading-relaxed text-muted-foreground">{risk.description}</p>

      <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted/20 p-3 text-center sm:grid-cols-4">
        <div>
          <p className="flex items-center justify-center gap-1 text-[10px] uppercase text-muted-foreground">
            <Activity className="h-3 w-3" aria-hidden /> Events
          </p>
          <p className="mt-0.5 font-mono text-lg font-semibold">{risk.live_events}</p>
        </div>
        <div>
          <p className="flex items-center justify-center gap-1 text-[10px] uppercase text-muted-foreground">
            <Ban className="h-3 w-3" aria-hidden /> Blocked
          </p>
          <p className="mt-0.5 font-mono text-lg font-semibold text-status-success">{risk.blocked_events}</p>
        </div>
        <div>
          <p className="flex items-center justify-center gap-1 text-[10px] uppercase text-muted-foreground">
            <AlertTriangle className="h-3 w-3" aria-hidden /> Breached
          </p>
          <p className="mt-0.5 font-mono text-lg font-semibold text-severity-critical">{risk.breached_events}</p>
        </div>
        <div>
          <p className="flex items-center justify-center gap-1 text-[10px] uppercase text-muted-foreground">
            <Gauge className="h-3 w-3" aria-hidden /> Max risk
          </p>
          <p className="mt-0.5 font-mono text-lg font-semibold text-severity-medium">
            {risk.max_risk_score.toFixed(1)}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {risk.attack_categories.map((cat) => (
            <Badge key={cat} variant="info" className="text-[10px]">
              {cat} · {CATEGORY_LABELS[cat] ?? cat}
            </Badge>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Layers className="h-3.5 w-3.5" aria-hidden />
          <span className="font-medium">Defenses:</span>
          {risk.defense_layers.map((layer) => (
            <Badge key={layer} variant="outline" className="font-mono text-[10px]">
              {DEFENSE_LAYER_LABELS[layer] ?? layer}
            </Badge>
          ))}
        </div>
        {risk.detectors.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Radar className="h-3.5 w-3.5" aria-hidden />
            <span className="font-medium">Detectors:</span>
            {risk.detectors.map((d) => (
              <Badge key={d} variant="secondary" className="font-mono text-[10px]">
                {d}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 space-y-2 border-t border-border pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Recommended mitigations
        </p>
        <ul className="space-y-1.5">
          {risk.mitigations.map((m) => (
            <li key={m} className="flex gap-2 text-xs text-muted-foreground">
              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-primary" aria-hidden />
              {m}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
        <Button asChild variant="outline" size="sm" className="font-mono text-[10px]">
          <Link href="/">Command Center</Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="font-mono text-[10px]">
          <Link href="/replay">Replay</Link>
        </Button>
        {primaryCategory && (
          <Button asChild variant="outline" size="sm" className="font-mono text-[10px]">
            <Link href={`/library?category=${encodeURIComponent(primaryCategory)}`}>
              Attack library · {primaryCategory}
            </Link>
          </Button>
        )}
      </div>
    </DashboardCard>
  );
}

export default function RiskFrameworkPage() {
  const { data, loading } = useRiskFramework();

  const framework = data?.framework ?? [];
  const criticalCount = framework.filter((r) => r.severity === "CRITICAL").length;
  const highCount = framework.filter((r) => r.severity === "HIGH").length;
  const totalBlocked = framework.reduce((acc, r) => acc + r.blocked_events, 0);
  const totalBreached = framework.reduce((acc, r) => acc + r.breached_events, 0);
  const defenseCoverage = new Set(framework.flatMap((r) => r.defense_layers));
  const coveragePct = framework.length
    ? Math.round((defenseCoverage.size / DEFENSE_LAYER_COUNT) * 100)
    : 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Agentic Risk Framework"
        description="OWASP-style Agentic AI Top 10 mapped to attack categories, defense layers, and detectors with live containment counts."
        icon={<ShieldAlert className="h-5 w-5" />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="font-mono">
              {framework.length} risks
            </Badge>
          </div>
        }
      />

      {loading ? (
        <PageLoadingSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <DashboardCard title="Framework Risks" contentClassName="flex items-center justify-between">
              <p className="font-mono text-3xl font-semibold">{framework.length}</p>
              <Badge variant="secondary">Top 10</Badge>
            </DashboardCard>
            <DashboardCard title="Critical / High" contentClassName="flex items-center justify-between">
              <p className="font-mono text-3xl font-semibold text-severity-critical">
                {criticalCount + highCount}
              </p>
              <Badge variant="warning">{highCount} high</Badge>
            </DashboardCard>
            <DashboardCard title="Blocked Events" contentClassName="flex items-center justify-between">
              <p className="font-mono text-3xl font-semibold text-status-success">{totalBlocked}</p>
              <Badge variant="success">contained</Badge>
            </DashboardCard>
            <DashboardCard title="Defense Coverage" contentClassName="space-y-2">
              <p className="font-mono text-3xl font-semibold">{coveragePct}%</p>
              <Progress value={coveragePct} className="h-1.5" aria-label={`${coveragePct}% defense coverage`} />
              <p className="text-xs text-muted-foreground">
                {defenseCoverage.size}/{DEFENSE_LAYER_COUNT} guardrail layers mapped
              </p>
              {totalBreached > 0 && (
                <p className="text-xs text-severity-critical">{totalBreached} breach events in window</p>
              )}
            </DashboardCard>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {framework.map((risk) => (
              <RiskCard key={risk.id} risk={risk} />
            ))}
          </div>

          {framework.length === 0 && (
            <EmptyState
              icon={ShieldAlert}
              title="Risk framework unavailable"
              description="The risk framework could not be loaded."
            />
          )}
        </>
      )}
    </div>
  );
}
