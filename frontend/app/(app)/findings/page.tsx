"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  FileSearch,
  ShieldPlus,
  RotateCcw,
  BookMarked,
  LayoutGrid,
  Table as TableIcon,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageStack } from "@/components/shared/PageStack";
import { FindingsSummaryBar } from "@/components/findings/FindingsSummaryBar";
import { FindingAttackMatrix } from "@/components/findings/FindingAttackMatrix";
import { FindingWorkbenchView } from "@/components/findings/FindingWorkbenchView";
import { FindingsTable } from "@/components/findings/FindingsTable";
import { FindingDetailDrawer } from "@/components/findings/FindingDetailDrawer";
import { Button } from "@/components/ui/button";
import { useFindings } from "@/lib/hooks/useFindings";
import { useAppData } from "@/lib/context/AppDataProvider";
import type { ExtendedFinding } from "@/lib/types/findings";
import { DEMO_BENCHMARK_FINDINGS } from "@/lib/findingsDemoData";
import { Sparkles, Radio, ShieldCheck as ShieldCheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export default function FindingsPage() {
  const { findings: rawFindings, playbookVersion, loading, unavailable, refresh } = useFindings();
  const { refreshPolicies } = useAppData();
  const [selected, setSelected] = useState<ExtendedFinding | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"workbench" | "table">("workbench");
  const [datasetMode, setDatasetMode] = useState<"auto" | "live" | "demo">("auto");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // When operational telemetry has 0 records, automatically provide the labeled
  // Pre-Flight Intelligence Benchmark so operators have immediate domain visibility.
  const isViewingDemo = datasetMode === "demo" || (datasetMode === "auto" && rawFindings.length === 0);
  const effectiveFindings: ExtendedFinding[] = isViewingDemo ? DEMO_BENCHMARK_FINDINGS : rawFindings;

  // Filtered by selected threat category in Attack Matrix
  const categoryFilteredFindings = useMemo(() => {
    if (activeCategory === "ALL") return effectiveFindings;
    return effectiveFindings.filter(
      (f) => f.asi_code === activeCategory || (f.category && f.category.toLowerCase().includes(activeCategory.toLowerCase()))
    );
  }, [effectiveFindings, activeCategory]);

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
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-xs font-mono font-bold text-emerald-800 shadow-lg animate-in fade-in duration-200">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        title="Security Findings & Vulnerability Posture"
        description="Backend-recorded security findings, evidence details, and policy promotion status."
        icon={<FileSearch className="h-5 w-5 text-slate-900" />}
        badge={
          <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 font-mono text-[10px] font-bold text-slate-700 shadow-2xs">
            Playbook v{loading || unavailable ? "—" : playbookVersion}
          </span>
        }
        actions={
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full lg:w-auto">
            {/* Primary Mode Switchers */}
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
              {/* Dataset Mode Switcher: Pre-Flight Benchmark vs Live Telemetry */}
              <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setDatasetMode("demo")}
                  className={cn(
                    "flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-md px-2 sm:px-2.5 py-1 font-mono text-xs font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-900",
                    isViewingDemo
                      ? "bg-black text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  )}
                  title="View 5 pre-flight intelligence scenarios across OWASP ASI01-ASI10 & MITRE ATLAS"
                >
                  <Sparkles className="h-3.5 w-3.5 shrink-0" />
                  <span>Benchmark ({DEMO_BENCHMARK_FINDINGS.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDatasetMode("live")}
                  className={cn(
                    "flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-md px-2 sm:px-2.5 py-1 font-mono text-xs font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-900",
                    !isViewingDemo
                      ? "bg-black text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  )}
                  title="View live operational findings recorded by the backend sensor database"
                >
                  <Radio className="h-3 w-3 shrink-0" />
                  <span>Live ({rawFindings.length})</span>
                </button>
              </div>

              {/* View Switcher: Workbench vs Table */}
              <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setViewMode("workbench")}
                  className={cn(
                    "flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-md px-2 sm:px-2.5 py-1 font-mono text-xs font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-900",
                    viewMode === "workbench"
                      ? "bg-black text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  )}
                >
                  <LayoutGrid className="h-3.5 w-3.5 shrink-0" />
                  <span>Studio</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={cn(
                    "flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-md px-2 sm:px-2.5 py-1 font-mono text-xs font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-900",
                    viewMode === "table"
                      ? "bg-black text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  )}
                >
                  <TableIcon className="h-3.5 w-3.5 shrink-0" />
                  <span>Table</span>
                </button>
              </div>
            </div>

            {/* Quick Action Navigation Links */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <Button asChild variant="outline" size="sm" className="flex-1 sm:flex-initial h-8 border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs">
                <Link href="/replay">
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5 text-slate-500 shrink-0" />
                  <span>Replay</span>
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="flex-1 sm:flex-initial h-8 border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs">
                <Link href="/admin/policies">
                  <BookMarked className="mr-1.5 h-3.5 w-3.5 text-slate-500 shrink-0" />
                  <span>Policies</span>
                </Link>
              </Button>
              <Button asChild size="sm" className="flex-1 sm:flex-initial h-8 bg-black text-xs font-semibold text-white hover:bg-slate-900 shadow-2xs">
                <Link href="/red-team/lab">
                  <ShieldPlus className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                  <span>Simulate</span>
                </Link>
              </Button>
            </div>
          </div>
        }
      />

      {/* Demonstration Benchmark Guidance Banner */}
      {isViewingDemo && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-3.5 shadow-2xs">
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-black text-white shadow-xs">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-900">
                  <span className="hidden sm:inline">Pre-Flight </span>Threat Intelligence Benchmark
                  <span className="hidden md:inline"> · Labeled Demonstration Suite</span>
                </span>
                <span className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-800 shrink-0">
                  OWASP ASI &amp; MITRE ATLAS
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-600 leading-relaxed font-sans">
                {rawFindings.length === 0
                  ? "Zero live breach telemetry recorded in the operational database. Displaying 5 pre-flight adversarial vectors covering prompt extraction, tool metadata SSRF, RAG data poisoning, SQL table exfiltration, and cascading failures."
                  : "Reviewing pre-flight intelligence benchmark scenarios. Switch to Live Telemetry to inspect active operational findings."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-stretch sm:self-center shrink-0">
            <Button asChild size="sm" className="h-7.5 bg-black hover:bg-slate-900 text-white font-mono text-xs gap-1.5 shadow-xs w-full sm:w-auto">
              <Link href="/red-team/lab">
                <ShieldPlus className="h-3.5 w-3.5" />
                Run Campaign in Lab
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* Zero Live Breaches Notification when user manually switches to Live with empty database */}
      {!isViewingDemo && rawFindings.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center space-y-3 shadow-2xs">
          <ShieldCheckIcon className="mx-auto h-8 w-8 text-emerald-600" />
          <h3 className="font-bold text-slate-900 text-sm">No Live Breaches Recorded</h3>
          <p className="text-xs text-slate-600 max-w-md mx-auto">
            The operational sensor database contains zero active breach findings. Your targets and agents are currently protected by active playbook policies.
          </p>
          <div className="flex justify-center gap-2 pt-1">
            <Button size="sm" onClick={() => setDatasetMode("demo")} className="bg-black hover:bg-slate-900 text-white text-xs h-8">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Explore Pre-Flight Threat Benchmark
            </Button>
            <Button asChild size="sm" variant="outline" className="text-xs h-8">
              <Link href="/red-team/lab">Launch Simulation</Link>
            </Button>
          </div>
        </div>
      )}

      {/* Top Executive KPI Ribbon */}
      <FindingsSummaryBar
        findings={effectiveFindings}
        playbookVersion={playbookVersion}
        loading={loading}
        unavailable={unavailable}
        onExport={handleExportJson}
        onExportSarif={handleExportSarif}
      />

      {/* Interactive MITRE ATLAS & OWASP LLM Attack Matrix */}
      <FindingAttackMatrix
        findings={effectiveFindings}
        activeCategory={activeCategory}
        onSelectCategory={(cat) => setActiveCategory(cat)}
      />

      {/* Main Content: Forensic Workbench View OR High-Density SOC Table */}
      {viewMode === "workbench" ? (
        <FindingWorkbenchView
          findings={categoryFilteredFindings}
          selectedFinding={selected}
          onSelectFinding={(f) => setSelected(f)}
          onPromoted={handlePromoted}
        />
      ) : (
        <FindingsTable
          rows={categoryFilteredFindings}
          loading={loading}
          selectedId={selected?.id ?? null}
          onSelect={(row) => setSelected(row)}
        />
      )}

      {/* Slide-over Inspection Drawer for SOC Table mode */}
      {viewMode === "table" && (
        <FindingDetailDrawer
          finding={selected}
          onClose={() => setSelected(null)}
          onPromoted={handlePromoted}
        />
      )}
    </PageStack>
  );
}
