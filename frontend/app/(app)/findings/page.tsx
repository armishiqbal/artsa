"use client";

import { useEffect, useState, useMemo } from "react";
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
  ShieldAlert,
  Terminal,
  Database,
  Layers,
  Network,
  Cpu,
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

const ASI_FILTER_CHIPS = [
  { id: "ALL", label: "All Vectors", icon: FileSearch },
  { id: "ASI01", label: "ASI01 Prompt Injection", icon: Terminal },
  { id: "ASI02", label: "ASI02 Sensitive Disclosure", icon: Network },
  { id: "ASI04", label: "ASI04 Insecure Tools", icon: ShieldAlert },
  { id: "ASI05", label: "ASI05 State Spill", icon: Cpu },
  { id: "ASI06", label: "ASI06 Excessive Agency", icon: Database },
  { id: "ASI08", label: "ASI08 RAG Poisoning", icon: Layers },
];

export default function FindingsPage() {
  const { findings: rawFindings, playbookVersion, loading, unavailable, refresh } = useFindings();
  const { refreshPolicies } = useAppData();
  const [selected, setSelected] = useState<ExtendedFinding | null>(null);
  const [datasetMode, setDatasetMode] = useState<"auto" | "live" | "demo">("auto");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // When operational telemetry has 0 records, automatically provide the labeled
  // Pre-Flight Intelligence Benchmark so operators have immediate domain visibility.
  const isViewingDemo = datasetMode === "demo" || (datasetMode === "auto" && rawFindings.length === 0);
  const effectiveFindings: ExtendedFinding[] = isViewingDemo ? DEMO_BENCHMARK_FINDINGS : rawFindings;

  // Real-time forensic metrics
  const totalFindings = effectiveFindings.length;
  const criticalCount = useMemo(() => effectiveFindings.filter((f) => f.severity === "CRITICAL").length, [effectiveFindings]);
  const highCount = useMemo(() => effectiveFindings.filter((f) => f.severity === "HIGH").length, [effectiveFindings]);
  const breachedCount = useMemo(() => effectiveFindings.filter((f) => f.verdict?.toUpperCase() === "BREACHED").length, [effectiveFindings]);
  const containedCount = useMemo(() => effectiveFindings.filter((f) => f.verdict?.toUpperCase() === "CONTAINED").length, [effectiveFindings]);
  const promotedCount = useMemo(() => effectiveFindings.filter((f) => f.status === "promoted" || Boolean(f.promoted_rule_name)).length, [effectiveFindings]);

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
    setToastMessage("Playbook rule promoted. Active proxy gates and sensor database refreshed.");
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
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 rounded-lg border border-emerald-800/80 bg-emerald-950 px-4 py-2.5 text-xs font-mono font-bold text-emerald-300 shadow-xl animate-in fade-in duration-200">
          <ShieldCheckIcon className="h-4 w-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Streamlined Executive Page Header */}
      <PageHeader
        title="Security Findings"
        description="Recorded exploit vectors, vulnerability analysis, and real-time playbook mitigation."
        icon={<FileSearch className="h-5 w-5 text-white" />}
        badge={
          <span className="rounded-md border border-neutral-800 bg-[#121212] px-2 py-0.5 font-mono text-[10px] font-bold text-neutral-300 shadow-2xs">
            Playbook v{loading || unavailable ? "—" : playbookVersion}
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            {/* Dataset Mode Switcher: Pre-Flight Benchmark vs Live Telemetry */}
            <div className="flex items-center rounded-lg border border-neutral-800 bg-[#0e0e0e] p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setDatasetMode("demo")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-xs font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-neutral-400",
                  isViewingDemo
                    ? "bg-white text-black font-bold shadow-2xs"
                    : "text-neutral-400 hover:text-white hover:bg-neutral-800"
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
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-xs font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-neutral-400",
                  !isViewingDemo
                    ? "bg-white text-black font-bold shadow-2xs"
                    : "text-neutral-400 hover:text-white hover:bg-neutral-800"
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
              className="h-8 border-neutral-800 bg-[#0e0e0e] text-xs font-semibold text-neutral-200 hover:bg-neutral-800 hover:text-white shadow-2xs"
              title="Download OASIS SARIF v2.1.0 security compliance report"
            >
              <FileCode2 className="mr-1.5 h-3.5 w-3.5 text-neutral-400 shrink-0" />
              <span>SARIF</span>
            </Button>

            {/* Export JSON */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportJson}
              className="h-8 border-neutral-800 bg-[#0e0e0e] text-xs font-semibold text-neutral-200 hover:bg-neutral-800 hover:text-white shadow-2xs"
              title="Export complete vulnerability dossier in JSON"
            >
              <Download className="mr-1.5 h-3.5 w-3.5 text-neutral-400 shrink-0" />
              <span>JSON</span>
            </Button>

            {/* Policies Hotpatch Quick-link */}
            <Button asChild variant="outline" size="sm" className="h-8 border-neutral-800 bg-[#0e0e0e] text-xs font-semibold text-neutral-200 hover:bg-neutral-800 hover:text-white shadow-2xs">
              <Link href="/admin/policies">
                <BookMarked className="mr-1.5 h-3.5 w-3.5 text-neutral-400 shrink-0" />
                <span>Policies</span>
              </Link>
            </Button>

            {/* Simulate Attack Primary Action */}
            <Button asChild size="sm" className="h-8 bg-white text-black font-semibold hover:bg-neutral-200 shadow-2xs">
              <Link href="/red-team/lab">
                <ShieldPlus className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                <span>Simulate Attack</span>
              </Link>
            </Button>
          </div>
        }
      />

      {/* Forensic Evidence Desk & Provenance HUD */}
      <section aria-label="Evidence Desk HUD" className="space-y-3">
        {/* Provenance Banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-800 bg-[#0e0e0e] px-4 py-2.5 font-mono text-xs">
          <div className="flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full shrink-0", isViewingDemo ? "bg-amber-400 animate-pulse" : "bg-emerald-400")} />
            <span className="font-bold uppercase tracking-wider text-white">
              {isViewingDemo ? "Pre-Flight Threat Benchmark (Walkthrough Mode)" : "Live Sensor Telemetry"}
            </span>
            <span className="text-neutral-600 hidden sm:inline">|</span>
            <span className="text-neutral-400 hidden sm:inline">
              {isViewingDemo
                ? "OWASP ASI01–ASI10 demonstration suite for offline policy synthesis and replay"
                : "Active audit records captured from live model proxies and tool executions"}
            </span>
          </div>
          <div className="flex items-center gap-3 text-neutral-400 text-[11px]">
            <span>Sensors: <strong className="text-white">Active</strong></span>
            <span className="text-neutral-700">·</span>
            <span>Cryptographic Proof: <strong className="text-emerald-400">HMAC-SHA256</strong></span>
          </div>
        </div>

        {/* 4 High-Density Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border border-neutral-800 bg-[#0e0e0e] p-3.5 space-y-1">
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-neutral-400">
              Total Exploit Vectors
            </p>
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-2xl font-bold tracking-tight text-white tabular-nums">
                {totalFindings}
              </span>
              <span className="font-mono text-[10px] text-neutral-500">recorded</span>
            </div>
            <p className="text-[11px] text-neutral-400">
              {isViewingDemo ? "Demonstration attack suite" : "Backend sensor database"}
            </p>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-[#0e0e0e] p-3.5 space-y-1">
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-neutral-400">
              Critical / High Severity
            </p>
            <div className="flex items-baseline gap-1.5 font-mono">
              <span className="text-2xl font-bold text-rose-400 tabular-nums">{criticalCount}</span>
              <span className="text-sm font-semibold text-neutral-600">/</span>
              <span className="text-lg font-bold text-amber-400 tabular-nums">{highCount}</span>
            </div>
            <p className="text-[11px] text-neutral-400">
              High priority mitigation queue
            </p>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-[#0e0e0e] p-3.5 space-y-1">
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-neutral-400">
              Breached vs Contained
            </p>
            <div className="flex items-baseline gap-1.5 font-mono">
              <span className="text-2xl font-bold text-rose-400 tabular-nums">{breachedCount}</span>
              <span className="text-sm font-semibold text-neutral-600">/</span>
              <span className="text-lg font-bold text-emerald-400 tabular-nums">{containedCount}</span>
            </div>
            <p className="text-[11px] text-neutral-400">
              Target execution arbitration
            </p>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-[#0e0e0e] p-3.5 space-y-1">
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-neutral-400">
              Playbook Mitigated
            </p>
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-2xl font-bold text-emerald-400 tabular-nums">
                {promotedCount}
              </span>
              <span className="font-mono text-[10px] text-neutral-500">rules</span>
            </div>
            <p className="text-[11px] text-neutral-400">
              Enforced in Playbook v{playbookVersion}
            </p>
          </div>
        </div>

        {/* Threat Category Filter Chips (OWASP ASI Taxonomy) */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
          {ASI_FILTER_CHIPS.map((chip) => {
            const IconComponent = chip.icon;
            const isSelected = selectedCategory === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setSelectedCategory(chip.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-xs font-semibold transition-all shrink-0 shadow-2xs",
                  isSelected
                    ? "border-white bg-white text-black font-bold"
                    : "border-neutral-800 bg-[#0e0e0e] text-neutral-400 hover:border-neutral-700 hover:text-white"
                )}
              >
                <IconComponent className="h-3.5 w-3.5 shrink-0" />
                <span>{chip.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Zero Live Breaches Notification when user manually switches to Live with empty database */}
      {!isViewingDemo && rawFindings.length === 0 && (
        <div className="rounded-xl border border-neutral-800 bg-[#0e0e0e] p-8 text-center space-y-3 shadow-2xs">
          <ShieldCheckIcon className="mx-auto h-8 w-8 text-emerald-400" />
          <h3 className="font-bold text-white text-base">No Live Breaches Recorded</h3>
          <p className="text-xs text-neutral-400 max-w-md mx-auto">
            The operational sensor database contains zero active breach findings. Your targets and agents are currently protected by active playbook policies.
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <Button size="sm" onClick={() => setDatasetMode("demo")} className="bg-white text-black hover:bg-neutral-200 text-xs h-8 font-semibold">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Explore Threat Benchmark
            </Button>
            <Button asChild size="sm" variant="outline" className="border-neutral-800 bg-neutral-900 text-neutral-200 text-xs h-8 hover:bg-neutral-800 hover:text-white">
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
        externalCategoryFilter={selectedCategory}
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
