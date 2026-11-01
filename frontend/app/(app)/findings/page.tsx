"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileSearch,
  ShieldPlus,
  BookMarked,
  Sparkles,
  Radio,
  Download,
  FileCode2,
  ShieldCheck as ShieldCheckIcon,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageStack } from "@/components/shared/PageStack";
import { FindingsTable } from "@/components/findings/FindingsTable";
import { FindingDetailDrawer } from "@/components/findings/FindingDetailDrawer";
import { Button } from "@/components/ui/button";
import { useFindings } from "@/lib/hooks/useFindings";
import { useAppData } from "@/lib/context/AppDataProvider";
import type { ExtendedFinding } from "@/lib/types/findings";
import { DEMO_BENCHMARK_FINDINGS } from "@/lib/findingsDemoData";
import { cn } from "@/lib/utils";

export default function FindingsPage() {
  const { findings: rawFindings, playbookVersion, loading, unavailable, refresh } = useFindings();
  const { refreshPolicies } = useAppData();
  const [selected, setSelected] = useState<ExtendedFinding | null>(null);
  const [datasetMode, setDatasetMode] = useState<"auto" | "live" | "demo">("auto");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // When operational telemetry has 0 records, automatically provide the labeled
  // Pre-Flight Intelligence Benchmark so operators have immediate domain visibility.
  const isViewingDemo = datasetMode === "demo" || (datasetMode === "auto" && rawFindings.length === 0);
  const effectiveFindings: ExtendedFinding[] = isViewingDemo ? DEMO_BENCHMARK_FINDINGS : rawFindings;

  useEffect(() => {
    if (loading) return;
    const findingId = new URLSearchParams(window.location.search).get("finding");
    if (!findingId) return;
    const match = effectiveFindings.find((finding) => finding.id === findingId);
    if (match) setSelected(match);
  }, [effectiveFindings, loading]);

  const handlePromoted = () => {
    void refresh();
    void refreshPolicies();
    setToastMessage("Playbook suggestion saved. Refreshing backend findings and policies.");
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(effectiveFindings, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `artsa-security-findings-dossier-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportSarif = () => {
    // Generate OASIS SARIF v2.1.0 standard report
    const sarifReport = {
      $schema: "https://json.schemastore.org/sarif-2.1.0.json",
      version: "2.1.0",
      runs: [
        {
          tool: {
            driver: {
              name: "ARTSA AI Red Team Simulation & Sensor Architecture",
              rules: effectiveFindings.map((f) => ({
                id: f.asi_code ?? f.id,
                name: f.title,
                shortDescription: { text: f.title },
                defaultConfiguration: {
                  level: f.severity === "CRITICAL" || f.severity === "HIGH" ? "error" : "warning",
                },
                properties: {
                  mitreAtlas: f.mitre_atlas,
                  impactScore: f.impact_score,
                },
              })),
            },
          },
          results: effectiveFindings.map((f) => ({
            ruleId: f.asi_code ?? f.id,
            level: f.severity === "CRITICAL" || f.severity === "HIGH" ? "error" : "warning",
            message: {
              text: f.title,
            },
            ...(f.target_agent || f.namespace
              ? { properties: { targetAgent: f.target_agent, namespace: f.namespace } }
              : {}),
          })),
        },
      ],
    };

    const blob = new Blob([JSON.stringify(sarifReport, null, 2)], {
      type: "application/sarif+json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `artsa-findings-sarif-v2.1-${new Date().toISOString().slice(0, 10)}.sarif.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageStack className="space-y-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950 px-4 py-2.5 text-xs font-mono font-bold text-emerald-800 dark:text-emerald-300 shadow-lg animate-in fade-in duration-200">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Streamlined Executive Page Header */}
      <PageHeader
        title="Security Findings"
        description="Recorded exploit vectors, vulnerability analysis, and real-time playbook mitigation."
        icon={<FileSearch className="h-5 w-5 text-foreground" />}
        badge={
          <span className="rounded-md border border-border bg-card px-2 py-0.5 font-mono text-[10px] font-bold text-foreground shadow-2xs">
            Playbook v{loading || unavailable ? "—" : playbookVersion}
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            {/* Dataset Mode Switcher: Pre-Flight Benchmark vs Live Telemetry */}
            <div className="flex items-center rounded-lg border border-border bg-card p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setDatasetMode("demo")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-xs font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-foreground",
                  isViewingDemo
                    ? "bg-foreground text-background shadow-2xs font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                title="View 5 pre-flight intelligence scenarios across OWASP ASI & MITRE ATLAS"
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                <span>Benchmark ({DEMO_BENCHMARK_FINDINGS.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setDatasetMode("live")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-xs font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-foreground",
                  !isViewingDemo
                    ? "bg-foreground text-background shadow-2xs font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                title="View live operational findings recorded by the backend sensor database"
              >
                <Radio className="h-3 w-3 shrink-0" />
                <span>Live ({rawFindings.length})</span>
              </button>
            </div>

            {/* Export SARIF */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportSarif}
              className="h-8 border-border bg-card text-xs font-semibold text-foreground hover:bg-muted shadow-2xs"
              title="Download OASIS SARIF v2.1.0 security compliance report"
            >
              <FileCode2 className="mr-1.5 h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span>SARIF</span>
            </Button>

            {/* Export JSON */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportJson}
              className="h-8 border-border bg-card text-xs font-semibold text-foreground hover:bg-muted shadow-2xs"
              title="Export complete vulnerability dossier in JSON"
            >
              <Download className="mr-1.5 h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span>JSON</span>
            </Button>

            {/* Policies Hotpatch Quick-link */}
            <Button asChild variant="outline" size="sm" className="h-8 border-border bg-card text-xs font-semibold text-foreground hover:bg-muted shadow-2xs">
              <Link href="/admin/policies">
                <BookMarked className="mr-1.5 h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span>Policies</span>
              </Link>
            </Button>

            {/* Simulate Attack Primary Action */}
            <Button asChild size="sm" className="h-8 bg-foreground text-background font-semibold hover:bg-foreground/90 shadow-2xs">
              <Link href="/red-team/lab">
                <ShieldPlus className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                <span>Simulate Attack</span>
              </Link>
            </Button>
          </div>
        }
      />

      {/* Zero Live Breaches Notification when user manually switches to Live with empty database */}
      {!isViewingDemo && rawFindings.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-8 text-center space-y-3 shadow-2xs">
          <ShieldCheckIcon className="mx-auto h-8 w-8 text-emerald-500" />
          <h3 className="font-bold text-foreground text-base">No Live Breaches Recorded</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            The operational sensor database contains zero active breach findings. Your targets and agents are currently protected by active playbook policies.
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <Button size="sm" onClick={() => setDatasetMode("demo")} className="bg-foreground text-background hover:bg-foreground/90 text-xs h-8 font-semibold">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Explore Threat Benchmark
            </Button>
            <Button asChild size="sm" variant="outline" className="border-border text-foreground text-xs h-8">
              <Link href="/red-team/lab">Launch Simulation</Link>
            </Button>
          </div>
        </div>
      )}

      {/* Main Single-View Triage Surface: Direct Full-Width Table */}
      <FindingsTable
        rows={effectiveFindings}
        loading={loading}
        selectedId={selected?.id ?? null}
        onSelect={(row) => setSelected(row)}
      />

      {/* Slide-over Inspection & Policy Hotpatch Drawer */}
      <FindingDetailDrawer
        finding={selected}
        onClose={() => setSelected(null)}
        onPromoted={handlePromoted}
      />
    </PageStack>
  );
}
