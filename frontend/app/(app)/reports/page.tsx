"use client";

import { useEffect, useState } from "react";
import { FileText, Download, ChevronRight, Loader2 } from "lucide-react";
import { fetchFromBackend } from "@/lib/api";
import { useCampaigns, type CampaignListItem } from "@/lib/hooks/useCampaigns";
import { useFindings } from "@/lib/hooks/useFindings";
import { useAppData } from "@/lib/context/AppDataProvider";
import { useDashboardMetrics } from "@/lib/hooks/useDashboardMetrics";
import { deriveCommandCenterKpis } from "@/lib/commandCenterKpis";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageStack } from "@/components/shared/PageStack";
import { ReadinessSnapshotPanel } from "@/components/reports/ReadinessSnapshotPanel";
import { FypExportPanel } from "@/components/reports/FypExportPanel";
import { DashboardCard } from "@/components/shared/DashboardCard";
import { EmptyState } from "@/components/shared/EmptyState";
import ModelComparison from "@/components/ModelComparison";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function ReportsPage() {
  const { campaigns, loading } = useCampaigns();
  const { findings, playbookVersion } = useFindings();
  const { playbookVersion: policyVersion } = useAppData();
  const { metrics, liveEvents } = useDashboardMetrics();
  const kpis = deriveCommandCenterKpis(
    metrics,
    liveEvents,
    playbookVersion || policyVersion,
    campaigns
  );
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignListItem | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportMd, setExportMd] = useState<string | null>(null);

  useEffect(() => {
    if (campaigns.length && !selectedCampaign) {
      setSelectedCampaign(campaigns[0]);
    }
  }, [campaigns, selectedCampaign]);

  const summary = selectedCampaign?.summary as Record<string, unknown> | undefined;

  const exportCompliance = async () => {
    if (!summary) return;
    setExporting(true);
    const result = await fetchFromBackend<{ report_markdown?: string }>("/api/v1/compliance/export", {
      method: "POST",
      body: JSON.stringify(summary),
    });
    if (result?.report_markdown) {
      setExportMd(result.report_markdown as string);
      const blob = new Blob([result.report_markdown as string], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `artsa-compliance-${selectedCampaign?.id ?? "report"}.md`;
      a.click();
      URL.revokeObjectURL(url);
    }
    setExporting(false);
  };

  // One-click boardroom-ready PDF (OWASP LLM Top 10, NIST, EU AI Act, ISO 42001).
  // Goes through the BFF proxy directly since it returns a binary PDF, not JSON.
  const exportPdf = async () => {
    if (!summary) return;
    setExporting(true);
    try {
      const res = await fetch("/api/backend/api/v1/compliance/export?format=pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(summary),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `artsa-compliance-${selectedCampaign?.id ?? "report"}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <PageStack>
      <PageHeader
        title="Assessment Reports"
        description="Executive red-team summaries, go-live readiness, and compliance exports."
        icon={<FileText className="h-5 w-5" />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm">
              <Link href="/campaigns">Red Team</Link>
            </Button>
            <Badge variant="secondary">{loading ? "…" : campaigns.length} campaigns</Badge>
          </div>
        }
      />

      <ReadinessSnapshotPanel />

      <FypExportPanel
        findings={findings}
        campaigns={campaigns}
        playbookVersion={playbookVersion || policyVersion}
        defenseScore={metrics?.defense_score ?? 0}
        threatsBlocked={kpis.threatsBlocked}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <DashboardCard title="Campaign Archive" contentClassName="p-0">
          <ScrollArea className="h-[520px]">
            {loading ? (
              <div className="space-y-2 p-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : campaigns.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No campaign reports yet"
                description="Run a red-team campaign for PDF exports, or export go-live readiness from Get Started."
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button asChild size="sm">
                      <Link href="/campaigns">Red Team</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href="/get-started">Get Started checklist</Link>
                    </Button>
                  </div>
                }
                className="m-4 border-0"
              />
            ) : (
              <ul className="divide-y divide-border">
                {campaigns.map((c) => (
                  <li key={String(c.id)}>
                    <button type="button" onClick={() => { setSelectedCampaign(c); setExportMd(null); }} className={cn("flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/60", selectedCampaign?.id === c.id && "bg-muted")}>
                      <div>
                        <p className="text-sm font-medium">{String(c.name)}</p>
                        <p className="text-[11px] text-muted-foreground">{String(c.model ?? "—")} · {String(c.provider ?? "—")}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </DashboardCard>

        <DashboardCard className="lg:col-span-2" title={selectedCampaign ? String(selectedCampaign.name) : "Report Detail"} contentClassName="space-y-6">
          {selectedCampaign ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
                <div>
                  <Badge variant="success" className="mb-2 uppercase">{String(selectedCampaign.status)}</Badge>
                  <p className="font-mono text-xs text-muted-foreground">ID: {String(selectedCampaign.id)} · Rounds: {String(selectedCampaign.rounds_completed ?? "—")}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-2" onClick={exportCompliance} disabled={!summary || exporting}>
                    {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    Export Markdown
                  </Button>
                  <Button size="sm" className="gap-2" onClick={exportPdf} disabled={!summary || exporting}>
                    {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                    Export PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => window.print()}>Print</Button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {[
                  { label: "Total Attacks", value: summary?.total_rounds ?? selectedCampaign.rounds_completed ?? 0 },
                  { label: "Blocked", value: (summary?.results_by_verdict as Record<string, number>)?.BLOCKED ?? 0 },
                  {
                    label: "Defense Score",
                    value:
                      summary?.avg_defense_quality != null
                        ? `${Number(summary.avg_defense_quality).toFixed(1)} / 10`
                        : "—",
                  },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-lg border border-border bg-muted/20 p-4 text-center">
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <p className="mt-1 font-mono text-2xl font-semibold">{String(stat.value)}</p>
                  </div>
                ))}
              </div>
              {exportMd && (
                <pre className="max-h-64 overflow-auto rounded-lg border border-border bg-muted/50 p-4 font-mono text-xs text-foreground">
                  {exportMd.length > 2000 ? `${exportMd.slice(0, 2000)}…` : exportMd}
                </pre>
              )}
            </>
          ) : (
            <EmptyState icon={FileText} title="Select a campaign" description="Choose a campaign or launch from Red Team." action={<Button asChild size="sm"><Link href="/campaigns">Red Team</Link></Button>} />
          )}
        </DashboardCard>
      </div>

      {/* Model comparison section */}
      <ModelComparison
        campaigns={campaigns.map((c) => ({
          id: String(c.id),
          name: String(c.name),
          provider: String(c.provider ?? "—"),
          model: String(c.model ?? "—"),
          status: String(c.status),
          rounds_completed: Number(c.rounds_completed ?? 0),
          total_rounds: Number(c.total_rounds ?? 0),
          summary: c.summary as Record<string, unknown> | undefined,
        }))}
      />
    </PageStack>
  );
}
