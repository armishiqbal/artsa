"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RedTeamScanWizard } from "@/components/wargame/RedTeamScanWizard";
import { useAuthRole } from "@/lib/hooks/useAuthRole";
import { useCampaigns, type CampaignListItem } from "@/lib/hooks/useCampaigns";
import { riskScoreFromSummary, severityFromRiskScore } from "@/lib/assessmentResults";
import { cn } from "@/lib/utils";

function StatusDot({ status }: { status: string }) {
  const s = status.toUpperCase();
  const tone =
    s === "COMPLETED"
      ? "bg-[hsl(var(--severity-low))]"
      : s === "FAILED" || s === "ERROR"
        ? "bg-[hsl(var(--severity-critical))]"
        : s === "RUNNING" || s === "PENDING"
          ? "bg-[hsl(var(--severity-medium))]"
          : "bg-muted-foreground";
  return <span className={cn("inline-block h-1.5 w-1.5 rounded-full", tone)} aria-hidden />;
}

function CampaignRow({ campaign }: { campaign: CampaignListItem }) {
  const risk = riskScoreFromSummary(campaign.summary ?? null);
  const severity = risk != null ? severityFromRiskScore(risk) : null;
  return (
    <Link
      href={`/red-team/monitor/${campaign.id}`}
      className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-border px-3 py-3 last:border-0 hover:bg-muted/25 sm:grid-cols-[minmax(0,1.4fr)_110px_90px_100px_80px]"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <StatusDot status={campaign.status} />
          <span className="truncate text-[13px] font-medium">{campaign.name}</span>
        </div>
        <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
          {campaign.provider}/{campaign.model}
        </p>
      </div>
      <span className="hidden font-mono text-[12px] tabular-nums text-muted-foreground sm:inline">
        {campaign.rounds_completed}/{campaign.total_rounds}
      </span>
      <span className="hidden text-[12px] uppercase tracking-wide text-muted-foreground sm:inline">
        {campaign.status}
      </span>
      <span className="hidden font-mono text-[12px] tabular-nums sm:inline">
        {risk != null ? `${risk}%` : "—"}
      </span>
      <div className="justify-self-end">
        {severity ? (
          <Badge
            variant={
              severity === "Critical" || severity === "High"
                ? "critical"
                : severity === "Medium"
                  ? "warning"
                  : "success"
            }
            className="meta-badge"
          >
            {severity}
          </Badge>
        ) : (
          <span className="text-[11px] text-muted-foreground">—</span>
        )}
      </div>
    </Link>
  );
}

function RedTeamCampaignsInner() {
  const searchParams = useSearchParams();
  const { capabilities, loading: authLoading } = useAuthRole();
  const { campaigns, loading } = useCampaigns();
  const [wizardOpen, setWizardOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("new") === "1") setWizardOpen(true);
  }, [searchParams]);

  const sorted = useMemo(
    () => [...campaigns].sort((a, b) => String(b.id).localeCompare(String(a.id))),
    [campaigns]
  );

  if (!authLoading && !capabilities.can_run_campaigns) {
    return (
      <div className="rounded-md border border-border px-4 py-8 text-center text-[13px] text-muted-foreground">
        Campaign access requires a red-team or admin role.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Campaigns</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Serious testing runs as campaigns — not one-off prompts.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link href="/red-team/campaigns/new">Campaign builder</Link>
          </Button>
          <Button size="sm" onClick={() => setWizardOpen(true)}>
            Launch scan
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-border">
        <div className="hidden grid-cols-[minmax(0,1.4fr)_110px_90px_100px_80px] gap-3 border-b border-border bg-muted/20 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground sm:grid">
          <span>Campaign</span>
          <span>Rounds</span>
          <span>Status</span>
          <span>Risk</span>
          <span className="text-right">Severity</span>
        </div>
        {loading && sorted.length === 0 ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <p className="px-3 py-10 text-center text-[13px] text-muted-foreground">
            No campaigns yet.{" "}
            <button
              type="button"
              className="text-foreground underline-offset-2 hover:underline"
              onClick={() => setWizardOpen(true)}
            >
              Launch your first scan
            </button>
            .
          </p>
        ) : (
          sorted.map((c) => <CampaignRow key={c.id} campaign={c} />)
        )}
      </div>

      <RedTeamScanWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </div>
  );
}

export default function RedTeamCampaignsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full" />}>
      <RedTeamCampaignsInner />
    </Suspense>
  );
}
