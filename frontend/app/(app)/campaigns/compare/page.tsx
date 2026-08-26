"use client";

import { useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { GitCompare, Swords } from "lucide-react";
import { useCampaigns } from "@/lib/hooks/useCampaigns";
import { useCampaignTranscript } from "@/lib/hooks/useCampaignTranscript";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageStack } from "@/components/shared/PageStack";
import { PageSuspenseFallback } from "@/components/shared/PageSuspenseFallback";
import { DashboardCard } from "@/components/shared/DashboardCard";
import { Button } from "@/components/ui/button";
import { AssessmentRiskHero } from "@/components/wargame/assessment/AssessmentRiskHero";
import { AssessmentCategoryBars } from "@/components/wargame/assessment/AssessmentCategoryBars";
import { CompareDeltaGraph } from "@/components/wargame/CompareDeltaGraph";
import {
  compareAssessmentResults,
  deriveAssessmentCategoryRows,
  deriveAssessmentRiskOverview,
} from "@/lib/assessmentResults";
import { cn } from "@/lib/utils";

function ScanPicker({
  label,
  value,
  onChange,
  campaigns,
  excludeId,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  campaigns: Array<{ id: string; name: string }>;
  excludeId?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#7c7c7c]">
        {label}
      </span>
      <select
        className="w-full rounded-[8px] border border-[#313131] bg-[#141414] px-3 py-2 text-[13px] text-white"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select campaign…</option>
        {campaigns
          .filter((c) => c.id !== excludeId)
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.name || c.id}
            </option>
          ))}
      </select>
    </label>
  );
}

function CompareSide({
  campaignId,
  title,
}: {
  campaignId: string;
  title: string;
}) {
  const { campaigns } = useCampaigns();
  const campaign = campaigns.find((c) => c.id === campaignId);
  const summary = (campaign?.summary as Record<string, unknown> | undefined) ?? null;
  const { turns } = useCampaignTranscript(campaignId || null, summary);
  const overview = useMemo(() => deriveAssessmentRiskOverview(turns), [turns]);
  const categories = useMemo(() => deriveAssessmentCategoryRows(turns), [turns]);

  return (
    <div className="space-y-3">
      <AssessmentRiskHero
        overview={overview}
        title={title}
        subtitle={campaign ? `${campaign.provider} · ${campaign.model}` : campaignId}
      />
      <DashboardCard title="By category" contentClassName="pt-2">
        <AssessmentCategoryBars rows={categories} />
      </DashboardCard>
    </div>
  );
}

export default function CompareScansPage() {
  return (
    <Suspense fallback={<PageSuspenseFallback label="Loading compare…" />}>
      <CompareScansInner />
    </Suspense>
  );
}

function CompareScansInner() {
  const searchParams = useSearchParams();
  const { campaigns } = useCampaigns();
  const [scanA, setScanA] = useState(searchParams.get("a") ?? "");
  const [scanB, setScanB] = useState(searchParams.get("b") ?? "");

  const campaignA = campaigns.find((c) => c.id === scanA);
  const campaignB = campaigns.find((c) => c.id === scanB);
  const summaryA = (campaignA?.summary as Record<string, unknown> | undefined) ?? null;
  const summaryB = (campaignB?.summary as Record<string, unknown> | undefined) ?? null;
  const { turns: turnsA } = useCampaignTranscript(scanA || null, summaryA);
  const { turns: turnsB } = useCampaignTranscript(scanB || null, summaryB);

  const categoriesA = useMemo(() => deriveAssessmentCategoryRows(turnsA), [turnsA]);
  const categoriesB = useMemo(() => deriveAssessmentCategoryRows(turnsB), [turnsB]);

  const delta = useMemo(() => {
    if (!scanA || !scanB || scanA === scanB) return null;
    return compareAssessmentResults(turnsA, turnsB);
  }, [scanA, scanB, turnsA, turnsB]);

  return (
    <PageStack>
      <PageHeader
        title="Wargame compare"
        description="Side-by-side campaign risk — verify remediations after hardening."
        icon={<GitCompare className="h-5 w-5" />}
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/campaigns">Back to Wargame</Link>
          </Button>
        }
      />

      <div className="grid gap-4 rounded-xl border border-[#313131] bg-[#0a0a0a] p-4 sm:grid-cols-2">
        <ScanPicker
          label="Campaign A"
          value={scanA}
          onChange={setScanA}
          campaigns={campaigns}
          excludeId={scanB}
        />
        <ScanPicker
          label="Campaign B"
          value={scanB}
          onChange={setScanB}
          campaigns={campaigns}
          excludeId={scanA}
        />
      </div>

      {scanA && scanB && scanA === scanB ? (
        <p className="text-center text-[13px] text-[#7c7c7c]">
          Choose two different campaigns to compare.
        </p>
      ) : null}

      {scanA && scanB && scanA !== scanB ? (
        <>
          {delta ? (
            <CompareDeltaGraph
              categoriesA={categoriesA}
              categoriesB={categoriesB}
              riskDelta={delta.riskDelta}
              labelA="A"
              labelB="B"
            />
          ) : null}

          {delta ? (
            <div className="rounded-xl border border-[#313131] bg-[#141414] px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#7c7c7c]">
                Risk delta (B − A)
              </p>
              <p
                className={cn(
                  "mt-1 font-mono text-2xl font-semibold tabular-nums",
                  delta.riskDelta < 0
                    ? "text-[#4ade80]"
                    : delta.riskDelta > 0
                      ? "text-[hsl(var(--severity-critical))]"
                      : "text-white"
                )}
              >
                {delta.riskDelta > 0 ? "+" : ""}
                {delta.riskDelta}%
              </p>
              <p className="mt-1 text-[11px] text-[#7c7c7c]">
                Negative delta means Campaign B is safer.
              </p>
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <CompareSide campaignId={scanA} title={campaignA?.name || "Campaign A"} />
            <CompareSide campaignId={scanB} title={campaignB?.name || "Campaign B"} />
          </div>

          {delta && delta.objectiveChanges.length > 0 ? (
            <DashboardCard
              title="Objective changes"
              description="Harmful vs safe per objective key"
              contentClassName="!p-0"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[12px]">
                  <thead className="border-b border-[#313131] bg-[#141414] font-mono text-[10px] uppercase tracking-[0.08em] text-[#7c7c7c]">
                    <tr>
                      <th className="px-3 py-2.5 font-medium">Objective</th>
                      <th className="px-3 py-2.5 font-medium">Campaign A</th>
                      <th className="px-3 py-2.5 font-medium">Campaign B</th>
                    </tr>
                  </thead>
                  <tbody>
                    {delta.objectiveChanges.map((row) => (
                      <tr key={row.key} className="border-b border-[#313131]/60">
                        <td className="px-3 py-2.5 text-white">{row.name}</td>
                        <td className="px-3 py-2.5 font-mono text-[10px] uppercase text-[#a7a7a7]">
                          {row.aHarmful == null ? "—" : row.aHarmful ? "Harmful" : "Safe"}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[10px] uppercase text-[#a7a7a7]">
                          {row.bHarmful == null ? "—" : row.bHarmful ? "Harmful" : "Safe"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DashboardCard>
          ) : null}
        </>
      ) : (
        <div className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-[#313131] text-center">
          <Swords className="mb-2 h-5 w-5 text-[#454545]" />
          <p className="text-[13px] text-[#7c7c7c]">
            Select Campaign A and Campaign B to compare wargame results.
          </p>
        </div>
      )}
    </PageStack>
  );
}
