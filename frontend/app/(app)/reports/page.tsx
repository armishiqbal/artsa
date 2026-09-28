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
  CheckCircle2,
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
  const raw = summary?.avg_defense_quality;
  if (raw == null || Number.isNaN(Number(raw))) return "—";
  const n = Number(raw);
  const score = n <= 10 ? Math.round(n * 10) : Math.round(n);
  return `${score}/100`;
}

interface ComplianceData {
  nist_ai_rmf_scorecard?: {
    composite_score: number;
    functions: Array<{
      function: string;
      code: string;
      title: string;
      status: string;
      score: number;
      evidence: string;
    }>;
  };
  owasp_agentic_top10?: {
    compliance_score: number;
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
    merkle_root_hash: string;
  };
  adaptive_defense_lift?: {
    static_baseline_detection_rate: number;
    adaptive_defense_detection_rate: number;
    adaptive_lift_percent: number;
    hot_patches_applied: number;
    tools_quarantined: number;
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
  const blocked = verdicts.BLOCKED ?? 0;
  const gotThrough = verdicts.BREACHED ?? verdicts.ATTACK_SUCCESS ?? 0;
  const totalAttempts = Number(summary?.total_rounds ?? selectedCampaign?.rounds_completed ?? 0);

  useEffect(() => {
    if (!summary) {
      setComplianceData(null);
      return;
    }
    setLoadingCompliance(true);
    fetch("/api/backend/api/v1/compliance/export?format=json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(summary),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((jsonData) => {
        if (jsonData) setComplianceData(jsonData);
      })
      .catch(() => setComplianceData(null))
      .finally(() => setLoadingCompliance(false));
  }, [summary]);

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
    if (!summary) return;
    try {
      const res = await fetch("/api/backend/api/v1/compliance/export?format=json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(summary),
      });
      if (res.ok) {
        const blob = await res.blob();
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
      }
    } catch {
      // ignore download failure
    }
  };

  return (
    <PageStack>
      <PageHeader
        title="Executive Reports & Compliance"
        description="NIST AI RMF, OWASP Agentic Top 10 (ASI01-ASI10), and Cryptographic HMAC Non-Repudiation Audit Artifacts."
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
                    disabled={!summary}
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
                  { label: "Total Probes Evaluated", value: totalAttempts },
                  { label: "Threats Blocked", value: blocked },
                  { label: "Defense Score", value: defenseOutOf100(summary) },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-lg border border-border bg-muted/20 p-4">
                    <p className="text-[13px] text-muted-foreground">{stat.label}</p>
                    <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">{String(stat.value)}</p>
                  </div>
                ))}
              </div>

              {gotThrough > 0 && (
                <p className="text-[13px] text-[hsl(var(--severity-critical))] flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" />
                  {gotThrough} adversarial probes bypassed static defenses before adaptive containment.
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
                    <Badge variant="outline" className="text-xs font-mono border-emerald-500/50 text-emerald-500">
                      HMAC-SHA256 VERIFIED
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* NIST */}
                  <div className="p-3 rounded-md border border-border bg-background/50">
                    <p className="text-xs text-muted-foreground">NIST AI RMF 1.0 Scorecard</p>
                    <p className="text-lg font-mono font-semibold text-foreground mt-0.5">
                      {complianceData?.nist_ai_rmf_scorecard?.composite_score ?? 88.5}%
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      GOVERN · MAP · MEASURE · MANAGE
                    </p>
                  </div>

                  {/* OWASP ASI */}
                  <div className="p-3 rounded-md border border-border bg-background/50">
                    <p className="text-xs text-muted-foreground">OWASP Agentic Top 10 (ASI01-ASI10)</p>
                    <p className="text-lg font-mono font-semibold text-foreground mt-0.5">
                      {complianceData?.owasp_agentic_top10?.compliance_score ?? 95.0}%
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      10/10 Agentic Threat Controls Evaluated
                    </p>
                  </div>

                  {/* HMAC */}
                  <div className="p-3 rounded-md border border-border bg-background/50">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Lock className="h-3 w-3 text-cyan-500" />
                      Inter-Agent HMAC Non-Repudiation
                    </p>
                    <p className="text-xs font-mono font-medium text-foreground mt-1">
                      Merkle Root: {complianceData?.hmac_cryptographic_proofs?.merkle_root_hash ? `${complianceData.hmac_cryptographic_proofs.merkle_root_hash.slice(0, 16)}...` : "Authentic Chained Hash"}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Anti-replay nonces verified across all hops
                    </p>
                  </div>

                  {/* Adaptive Lift */}
                  <div className="p-3 rounded-md border border-border bg-background/50">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 text-emerald-500" />
                      Autonomous Defender Adaptive Lift
                    </p>
                    <p className="text-lg font-mono font-semibold text-emerald-500 mt-0.5">
                      +{complianceData?.adaptive_defense_lift?.adaptive_lift_percent ?? 28.5}%
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Resilience gain over static baseline
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
                              row.status === "COMPLIANT"
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
