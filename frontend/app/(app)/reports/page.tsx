"use client";

import { useEffect, useState } from "react";
import {
  FileText,
  Download,
  ChevronRight,
  Loader2,
  ShieldCheck,
  Lock,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import { useCampaigns, type CampaignListItem } from "@/lib/hooks/useCampaigns";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageStack } from "@/components/shared/PageStack";
import { DashboardCard } from "@/components/shared/DashboardCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { buildHeaders, fetchFromBackend } from "@/lib/api";
import Link from "next/link";

function statusLabel(status: string): string {
  const s = status.toLowerCase();
  if (s === "completed" || s === "complete") return "Complete";
  if (s === "running" || s === "in_progress") return "Running";
  if (s === "failed") return "Failed";
  if (!status) return "—";
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

function defenseOutOf100(summary: Record<string, unknown> | undefined): string {
  const raw = summary?.defense_score;
  if (raw == null || Number.isNaN(Number(raw))) return "—";
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 100) return "—";
  return `${Math.round(n)}/100`;
}

interface ComplianceData {
  nist_ai_rmf_scorecard?: {
    composite_score: number | null;
    functions: Array<{
      function: string;
      code: string;
      title: string;
      status: string;
      score: number | null;
      evidence: string;
    }>;
  };
  owasp_agentic_top10?: {
    compliance_score: number | null;
    summary?: { not_assessed?: number };
    rows: Array<{
      id: string;
      name: string;
      status: string;
      control: string;
      finding: string;
    }>;
  };
  hmac_cryptographic_proofs?: {
    algorithm: string;
    non_repudiation_status: string;
    total_signed_hops: number;
    verified_hops: number;
    merkle_root_hash: string | null;
  };
  adaptive_defense_lift?: {
    static_baseline_detection_rate: number | null;
    adaptive_defense_detection_rate: number | null;
    adaptive_lift_percent: number | null;
    judged_outcomes: number | null;
    hot_patches_applied: number | null;
    tools_quarantined: number | null;
  };
}

export default function ReportsPage() {
  const { campaigns, loading } = useCampaigns();
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignListItem | null>(
    () => (campaigns.length ? campaigns[0] : null)
  );
  const [exporting, setExporting] = useState(false);
  const [complianceData, setComplianceData] = useState<ComplianceData | null>(null);
  const [loadingCompliance, setLoadingCompliance] = useState(false);

  useEffect(() => {
    if (campaigns.length && !selectedCampaign) {
      setSelectedCampaign(campaigns[0]);
    }
  }, [campaigns, selectedCampaign]);

  const summary = selectedCampaign?.summary as Record<string, unknown> | undefined;
  const verdicts = (summary?.results_by_verdict as Record<string, number> | undefined) ?? {};
  const blocked = typeof verdicts.BLOCKED === "number" ? verdicts.BLOCKED : null;
  const gotThroughValue = verdicts.BREACHED ?? verdicts.ATTACK_SUCCESS;
  const gotThrough = typeof gotThroughValue === "number" ? gotThroughValue : null;
  const gotThroughLabel = verdicts.BREACHED != null ? "BREACHED" : "ATTACK_SUCCESS";
  const totalAttemptsRaw = summary?.total_rounds ?? selectedCampaign?.rounds_completed;
  const totalAttempts = typeof totalAttemptsRaw === "number" ? totalAttemptsRaw : null;

  useEffect(() => {
    const campaignId = selectedCampaign?.id == null ? "" : String(selectedCampaign.id);
    if (!campaignId || !summary) {
      setComplianceData(null);
      setLoadingCompliance(false);
      return;
    }
    setLoadingCompliance(true);
    void fetchFromBackend<ComplianceData>(
      `/api/v1/compliance/report/export?format=json&campaign_id=${encodeURIComponent(campaignId)}`,
      { silent: true }
    )
      .then((jsonData) => {
        setComplianceData(jsonData);
      })
      .catch(() => setComplianceData(null))
      .finally(() => setLoadingCompliance(false));
  }, [selectedCampaign?.id, summary]);

  const exportPdf = async () => {
    if (!selectedCampaign?.id) return;
    setExporting(true);
    try {
      const campaignId = encodeURIComponent(String(selectedCampaign.id));
      const res = await fetch(
        `/api/backend/api/v1/compliance/report/export?format=pdf&campaign_id=${campaignId}`,
        { headers: buildHeaders() }
      );
      if (res.ok) {
        const blob = await res.blob();
        if (typeof window !== "undefined" && typeof URL.createObjectURL === "function") {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `artsa-compliance-${selectedCampaign?.id ?? "export"}.pdf`;
          a.click();
          if (typeof URL.revokeObjectURL === "function") {
            URL.revokeObjectURL(url);
          }
        }
      }
    } finally {
      setExporting(false);
    }
  };

  const exportJson = async () => {
    if (!complianceData) return;
    try {
      const blob = new Blob([JSON.stringify(complianceData, null, 2)], { type: "application/json" });
      if (typeof window !== "undefined" && typeof URL.createObjectURL === "function") {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `artsa-audit-${selectedCampaign?.id ?? "export"}.json`;
        a.click();
        if (typeof URL.revokeObjectURL === "function") {
          URL.revokeObjectURL(url);
        }
      }
    } catch {
      // Browser download failed.
    }
  };

  return (
    <PageStack>
      <PageHeader
        title="Executive Reports & Compliance"
        description="Campaign evidence exports. Framework control scores remain unavailable until structured assessment evidence is recorded."
        icon={<FileText className="h-5 w-5" />}
        actions={
          <Button asChild size="sm">
            <Link href="/red-team/lab">Attack Lab</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <DashboardCard title="Attack tests" contentClassName="p-0">
          <ScrollArea className="h-[580px]">
            {loading ? (
              <div className="space-y-2 p-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : campaigns.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No attack tests yet"
                description="Run a test in Attack Lab, then come back here to export compliance artifacts."
                action={
                  <Button asChild size="sm">
                    <Link href="/red-team/lab">Attack Lab</Link>
                  </Button>
                }
                className="m-4 border-0"
              />
            ) : (
              <ul className="divide-y divide-border">
                {campaigns.map((c) => (
                  <li key={String(c.id)}>
                    <button
                      type="button"
                      onClick={() => setSelectedCampaign(c)}
                      className={cn(
                        "flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/60",
                        selectedCampaign?.id === c.id && "bg-muted"
                      )}
                    >
                      <div>
                        <p className="text-sm font-medium">{String(c.name)}</p>
                        <p className="text-[13px] text-muted-foreground">
                          {String(c.model ?? "—")} · {statusLabel(String(c.status ?? ""))}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </DashboardCard>

        <DashboardCard
          className="lg:col-span-2"
          title={selectedCampaign ? String(selectedCampaign.name) : "Report"}
          contentClassName="space-y-6"
        >
          {selectedCampaign ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
                <div>
                  <Badge variant="secondary" className="mb-2">
                    {statusLabel(String(selectedCampaign.status))}
                  </Badge>
                  {loadingCompliance && (
                    <Badge variant="outline" className="mb-2 ml-2">Loading report evidence</Badge>
                  )}
                  <p className="text-[13px] text-muted-foreground">
                    {String(selectedCampaign.provider ?? "—")} · {String(selectedCampaign.model ?? "—")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-xs"
                    onClick={() => void exportJson()}
                    disabled={!complianceData}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export Audit JSON
                  </Button>
                  <Button
                    size="sm"
                    className="gap-2"
                    onClick={() => void exportPdf()}
                    disabled={!summary || exporting}
                  >
                    {exporting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    Export Executive PDF
                  </Button>
                </div>
              </div>

              {/* Top stats */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {[
                  { label: "Total Probes Evaluated", value: totalAttempts ?? "—" },
                  { label: "Threats Blocked", value: blocked ?? "—" },
                  { label: "Defense Score", value: defenseOutOf100(summary) },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-lg border border-border bg-muted/20 p-4">
                    <p className="text-[13px] text-muted-foreground">{stat.label}</p>
                    <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">{String(stat.value)}</p>
                  </div>
                ))}
              </div>

              {gotThrough !== null && gotThrough > 0 && (
                <p className="text-[13px] text-[hsl(var(--severity-critical))] flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" />
                  {gotThrough} outcomes in this campaign summary were marked {gotThroughLabel}.
                </p>
              )}

              {/* Compliance & Verification Assurance Grid */}
              <div className="rounded-lg border border-border bg-muted/10 p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm font-semibold">Governance & Cryptographic Proofs</span>
                  </div>
                  {complianceData?.hmac_cryptographic_proofs && (
                    <Badge variant="outline" className="text-xs font-mono">
                      {complianceData.hmac_cryptographic_proofs.non_repudiation_status}
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* NIST */}
                  <div className="p-3 rounded-md border border-border bg-background/50">
                    <p className="text-xs text-muted-foreground">NIST AI RMF 1.0 Scorecard</p>
                    <p className="text-lg font-mono font-semibold text-foreground mt-0.5">
                      {complianceData?.nist_ai_rmf_scorecard?.composite_score == null
                        ? "Not assessed"
                        : `${complianceData.nist_ai_rmf_scorecard.composite_score}%`}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      GOVERN · MAP · MEASURE · MANAGE
                    </p>
                  </div>

                  {/* OWASP ASI */}
                  <div className="p-3 rounded-md border border-border bg-background/50">
                    <p className="text-xs text-muted-foreground">OWASP Agentic Top 10 (ASI01-ASI10)</p>
                    <p className="text-lg font-mono font-semibold text-foreground mt-0.5">
                      {complianceData?.owasp_agentic_top10?.compliance_score == null
                        ? "Not assessed"
                        : `${complianceData.owasp_agentic_top10.compliance_score}%`}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {complianceData?.owasp_agentic_top10?.summary?.not_assessed ?? 10}/10 controls not assessed
                    </p>
                  </div>

                  {/* HMAC */}
                  <div className="p-3 rounded-md border border-border bg-background/50">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Lock className="h-3 w-3 text-cyan-500" />
                      Inter-Agent HMAC Non-Repudiation
                    </p>
                    <p className="text-xs font-mono font-medium text-foreground mt-1">
                      Merkle Root: {complianceData?.hmac_cryptographic_proofs?.merkle_root_hash
                        ? `${complianceData.hmac_cryptographic_proofs.merkle_root_hash.slice(0, 16)}...`
                        : "Unavailable — no audit rows"}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {complianceData?.hmac_cryptographic_proofs
                        ? `${complianceData.hmac_cryptographic_proofs.verified_hops}/${complianceData.hmac_cryptographic_proofs.total_signed_hops} recorded handoffs verified`
                        : "Handoff verification unavailable"}
                    </p>
                  </div>

                  {/* Adaptive Lift */}
                  <div className="p-3 rounded-md border border-border bg-background/50">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 text-emerald-500" />
                      Autonomous Defender Adaptive Lift
                    </p>
                    <p className="text-lg font-mono font-semibold text-emerald-500 mt-0.5">
                      {complianceData?.adaptive_defense_lift?.adaptive_lift_percent == null
                        ? "Unavailable"
                        : `${complianceData.adaptive_defense_lift.adaptive_lift_percent > 0 ? "+" : ""}${complianceData.adaptive_defense_lift.adaptive_lift_percent}%`}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {complianceData?.adaptive_defense_lift
                        ? `${complianceData.adaptive_defense_lift.judged_outcomes == null ? "No judged outcomes recorded" : `${complianceData.adaptive_defense_lift.judged_outcomes} judged outcomes`} · baseline ${complianceData.adaptive_defense_lift.static_baseline_detection_rate == null ? "unavailable" : `${complianceData.adaptive_defense_lift.static_baseline_detection_rate}%`}`
                        : "No measured campaign comparison"}
                    </p>
                  </div>
                </div>

                {/* OWASP Agentic Top 10 Quick Overview */}
                {complianceData?.owasp_agentic_top10?.rows && (
                  <div className="space-y-2 pt-2 border-t border-border">
                    <p className="text-xs font-medium text-muted-foreground">Agentic Control Verification Summary:</p>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {complianceData.owasp_agentic_top10.rows.map((row) => (
                        <div
                          key={row.id}
                          className="p-2 rounded border border-border bg-muted/20 text-center"
                          title={`${row.name}: ${row.control}`}
                        >
                          <span className="text-[11px] font-mono block font-semibold">{row.id}</span>
                          <span
                            className={cn(
                              "text-[10px] font-medium block",
                              row.status === "NOT_ASSESSED"
                                ? "text-muted-foreground"
                                : row.status === "COMPLIANT"
                                ? "text-emerald-500"
                                : row.status === "PARTIAL"
                                ? "text-amber-500"
                                : "text-rose-500"
                            )}
                          >
                            {row.status === "COMPLIANT" ? "PASS" : row.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <EmptyState
              icon={FileText}
              title="Select a test"
              description="Choose an attack test on the left, or run a new one in Attack Lab."
              action={
                <Button asChild size="sm">
                  <Link href="/red-team/lab">Attack Lab</Link>
                </Button>
              }
            />
          )}
        </DashboardCard>
      </div>
    </PageStack>
  );
}
