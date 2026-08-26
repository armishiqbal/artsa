"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GitCompare, Plus, Swords, Target } from "lucide-react";
import { useAuthRole } from "@/lib/hooks/useAuthRole";
import { useCampaigns } from "@/lib/hooks/useCampaigns";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageStack } from "@/components/shared/PageStack";
import { PageSuspenseFallback } from "@/components/shared/PageSuspenseFallback";
import { LiveIndicator } from "@/components/shared/LiveIndicator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RedTeamScanWizard } from "@/components/wargame/RedTeamScanWizard";
import { useConnection } from "@/lib/context/ConnectionProvider";
import {
  deriveAssessmentRiskOverview,
  riskScoreFromSummary,
  severityFromRiskScore,
} from "@/lib/assessmentResults";
import { parseTopFindings } from "@/lib/campaignTranscript";
import type { CampaignListItem } from "@/lib/hooks/useCampaigns";
import { cn } from "@/lib/utils";

function ScanRiskCell({ campaign }: { campaign: CampaignListItem }) {
  const summary = (campaign.summary as Record<string, unknown> | undefined) ?? null;
  const fromSummary = riskScoreFromSummary(summary);
  const findings = parseTopFindings(summary);
  const overview = deriveAssessmentRiskOverview(findings);
  const risk = fromSummary ?? (overview.totalEvaluations > 0 ? overview.riskScore : null);
  const severity = risk != null ? severityFromRiskScore(risk) : "None";

  if (risk == null) {
    return <span className="font-mono text-[12px] text-[#454545]">—</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[13px] font-semibold tabular-nums text-white">{risk}%</span>
      <Badge
        variant={
          severity === "Critical" || severity === "High"
            ? "critical"
            : severity === "Medium"
              ? "warning"
              : severity === "Low"
                ? "success"
                : "secondary"
        }
        className="meta-badge"
      >
        {severity}
      </Badge>
    </div>
  );
}

function ScansListInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { capabilities, loading: authLoading } = useAuthRole();
  const { campaigns, loading } = useCampaigns();
  const { apiOnline, wsConnected } = useConnection();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardTarget, setWizardTarget] = useState<string | null>(null);
  const [wizardCategory, setWizardCategory] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...campaigns].sort((a, b) => String(b.id).localeCompare(String(a.id))),
    [campaigns]
  );

  const openWizard = (opts?: { target?: string | null; category?: string | null }) => {
    setWizardTarget(opts?.target ?? null);
    setWizardCategory(opts?.category ?? null);
    setWizardOpen(true);
  };

  // Deep links: /campaigns?new=1&target=…&category=…
  useEffect(() => {
    if (searchParams.get("new") === "1" || searchParams.get("target") || searchParams.get("category")) {
      openWizard({
        target: searchParams.get("target"),
        category: searchParams.get("category"),
      });
      router.replace("/campaigns", { scroll: false });
    }
  }, [searchParams, router]);

  if (!authLoading && !capabilities.can_run_campaigns) {
    return (
      <PageStack>
        <PageHeader
          title="Wargame"
          description="Automated adversarial campaigns against AI applications and agents."
          icon={<Swords className="h-5 w-5" />}
        />
        <EmptyState
          icon={Swords}
          title="Wargame access restricted"
          description="Your role cannot launch campaigns. Contact an admin for redteam or analyst access."
        />
      </PageStack>
    );
  }

  return (
    <PageStack>
      <PageHeader
        title="Wargame"
        description="Adversarial campaign theater — launch, track risk, open live engagements."
        icon={<Swords className="h-5 w-5" />}
        badge={<LiveIndicator connected={apiOnline && wsConnected} className="meta-badge" />}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/campaigns/targets">
                <Target className="h-3.5 w-3.5" />
                Targets
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/campaigns/compare">
                <GitCompare className="h-3.5 w-3.5" />
                Compare
              </Link>
            </Button>
            <Button size="sm" onClick={() => openWizard()}>
              <Plus className="h-3.5 w-3.5" />
              Launch wargame
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full rounded-[8px]" />
          <Skeleton className="h-12 w-full rounded-[8px]" />
          <Skeleton className="h-12 w-full rounded-[8px]" />
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={Swords}
          title="No campaigns yet"
          description="Configure a target and launch your first wargame engagement."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href="/campaigns/targets">View targets</Link>
              </Button>
              <Button size="sm" onClick={() => openWizard()}>
                Launch wargame
              </Button>
            </div>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#313131] bg-[#0a0a0a]">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-[#313131] bg-[#141414] font-mono text-[10px] uppercase tracking-[0.08em] text-[#7c7c7c]">
              <tr>
                <th className="px-4 py-3 font-medium">Campaign</th>
                <th className="px-4 py-3 font-medium">Target</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Rounds</th>
                <th className="px-4 py-3 font-medium">Risk</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-[#313131]/60 transition-colors hover:bg-[#1a1a1a]"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/campaigns/${c.id}`}
                      className="font-medium text-white hover:underline"
                    >
                      {c.name || c.id}
                    </Link>
                    <p className="font-mono text-[10px] text-[#454545]">{c.id}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-[#a7a7a7]">{c.provider}</p>
                    <p className="font-mono text-[10px] text-[#454545]">{c.model}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "font-mono text-[10px] uppercase",
                        c.status.toUpperCase() === "COMPLETED"
                          ? "text-[#4ade80]"
                          : c.status.toUpperCase().includes("FAIL")
                            ? "text-[hsl(var(--severity-critical))]"
                            : "text-[#6798ff]"
                      )}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums text-[#a7a7a7]">
                    {c.rounds_completed}/{c.total_rounds || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <ScanRiskCell campaign={c} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <RedTeamScanWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        initialTargetId={wizardTarget}
        initialCategory={wizardCategory}
      />
    </PageStack>
  );
}

export default function ScansListPage() {
  return (
    <Suspense fallback={<PageSuspenseFallback label="Loading scans…" />}>
      <ScansListInner />
    </Suspense>
  );
}
