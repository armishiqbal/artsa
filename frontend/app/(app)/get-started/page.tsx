"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDashboardMetrics } from "@/lib/hooks/useDashboardMetrics";
import Link from "next/link";
import { Shield, ArrowRight, Key, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { LiveIndicator } from "@/components/shared/LiveIndicator";
import { OnboardingHub } from "@/components/get-started/OnboardingHub";
import { CustomerApiHub } from "@/components/get-started/CustomerApiHub";
import { Button } from "@/components/ui/button";
import { fetchFromBackend } from "@/lib/api";
import { useConnection } from "@/lib/context/ConnectionProvider";
import {
  VALIDATION_CASES,
  buildCaseDetail,
  exportReadinessReport,
  exportReadinessMarkdown,
  exportReadinessPdf,
  type CaseRunDetail,
  type IngestSmokeResult,
  type ScanResultView,
  type ValidationCase,
} from "@/lib/getStarted";
import {
  computeReadinessFlow,
} from "@/lib/readinessFlow";
import { PageStack } from "@/components/shared/PageStack";
import { verdictSummary, type VerdictSummary } from "@/lib/verdict";

interface IngestApiResponse {
  session_id?: string;
  risk_score?: { overall_score?: number };
  verdict?: { verdict?: string; recommended_action?: string };
}

export default function GetStartedPage() {
  const { apiOnline, wsConnected } = useConnection();
  const { metrics, liveEvents, loading: metricsLoading, refreshMetrics } = useDashboardMetrics();
  const [activeTab, setActiveTab] = useState<"keys" | "readiness">("keys");
  const [activeCaseId, setActiveCaseId] = useState(VALIDATION_CASES[0].id);
  const [batchRunning, setBatchRunning] = useState(false);
  const [suiteProgress, setSuiteProgress] = useState<{
    current: number;
    total: number;
    label: string;
  } | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [lastScan, setLastScan] = useState<ScanResultView | null>(null);
  const [summary, setSummary] = useState<VerdictSummary | null>(null);
  const [firedDetector, setFiredDetector] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [caseDetails, setCaseDetails] = useState<Record<string, CaseRunDetail>>({});
  const [ingestLoading, setIngestLoading] = useState(false);
  const [ingestResult, setIngestResult] = useState<IngestSmokeResult | null>(null);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [exportLoading, setExportLoading] = useState(false);

  const activeCase = VALIDATION_CASES.find((c) => c.id === activeCaseId) ?? VALIDATION_CASES[0];
  const suitePass = Object.values(caseDetails).filter((d) => d.passed).length;
  const suiteTotal = VALIDATION_CASES.length;

  const flow = useMemo(
    () =>
      computeReadinessFlow({
        apiOnline,
        wsConnected,
        suitePass,
        suiteTotal,
        casesRun: Object.keys(caseDetails).length,
        ingestDone: Boolean(ingestResult),
        trafficConfirmed: liveEvents.length > 0 || (metrics?.total_events ?? 0) > 0,
      }),
    [apiOnline, wsConnected, suitePass, suiteTotal, caseDetails, ingestResult, liveEvents.length, metrics?.total_events]
  );

  const selectCase = useCallback((id: string) => {
    setActiveCaseId(id);
    setScanError(null);
  }, []);

  const runAllValidations = useCallback(async () => {
    setBatchRunning(true);
    setScanError(null);
    for (let i = 0; i < VALIDATION_CASES.length; i++) {
      const c = VALIDATION_CASES[i];
      setSuiteProgress({ current: i + 1, total: VALIDATION_CASES.length, label: c.label });
      try {
        const start = performance.now();
        const res = await fetchFromBackend<ScanResultView>("/api/v1/scan", {
          method: "POST",
          body: JSON.stringify({
            prompt: c.user_input,
            system_prompt: c.system_prompt,
            model: "gpt-4o",
            temperature: 0.1,
          }),
        });
        const elapsed = Math.round(performance.now() - start);
        if (res) {
          const detail = buildCaseDetail(c, res, elapsed);
          setCaseDetails((prev) => ({ ...prev, [c.id]: detail }));
        }
      } catch (e) {
        const detail: CaseRunDetail = {
          passed: false,
          risk: 0,
          verdict: "ERROR",
          result: {
            risk_score: 0,
            verdict: "ERROR",
            recommended_action: "RETRY",
          },
          summary: verdictSummary({
            verdict: "ERROR",
            riskScore: 0,
            recommendedAction: "RETRY",
            detector: null,
          }),
          firedDetector: null,
          latencyMs: 0,
          at: new Date().toISOString(),
        };
        setCaseDetails((prev) => ({ ...prev, [c.id]: detail }));
      }
    }
    setBatchRunning(false);
    setSuiteProgress(null);
  }, []);

  const runIngestSmoke = useCallback(async () => {
    setIngestLoading(true);
    setIngestError(null);
    const start = performance.now();
    try {
      const res = await fetchFromBackend<IngestApiResponse>("/api/v1/ingest", {
        method: "POST",
        body: JSON.stringify({
          session_id: "smoke-" + Date.now(),
          agent_id: "get-started-smoke",
          tool_name: "validate_access",
          tool_args: { scope: "read_only" },
          context_prompt: "Verify agent connection.",
          tenant_id: "default",
        }),
      });
      const elapsed = Math.round(performance.now() - start);
      setIngestResult({
        sessionId: res?.session_id ?? "smoke-" + Date.now(),
        latencyMs: elapsed,
        risk: res?.risk_score?.overall_score ?? 15,
        verdict: res?.verdict?.verdict ?? "ALLOW",
        action: res?.verdict?.recommended_action ?? "ALLOW",
        at: new Date().toISOString(),
      });
      void refreshMetrics();
    } catch (e) {
      setIngestError(e instanceof Error ? e.message : "Ingest failed");
      setIngestResult(null);
    } finally {
      setIngestLoading(false);
    }
  }, [refreshMetrics]);

  const exportOpts = useMemo(
    () => ({
      cases: VALIDATION_CASES,
      caseDetails,
      ingest: ingestResult,
      readinessPct: flow.score,
    }),
    [caseDetails, ingestResult, flow.score]
  );

  const handleExportJson = useCallback(() => {
    exportReadinessReport(exportOpts);
  }, [exportOpts]);

  const handleExportMarkdown = useCallback(async () => {
    setExportLoading(true);
    await exportReadinessMarkdown(exportOpts);
    setExportLoading(false);
  }, [exportOpts]);

  const handleExportPdf = useCallback(async () => {
    setExportLoading(true);
    await exportReadinessPdf(exportOpts);
    setExportLoading(false);
  }, [exportOpts]);

  const canExport = Object.keys(caseDetails).length > 0;

  return (
    <PageStack>
      <PageHeader
        title="Get Started & Developer Setup"
        description="Generate live API keys, integrate with Python / LangChain in 3 lines, and verify sub-50ms containment."
        icon={<Shield className="h-5 w-5" />}
        badge={
          <LiveIndicator
            connected={apiOnline}
            label={apiOnline ? "Gateway Live (<50ms)" : "Offline Fallback"}
            className="text-[10px]"
          />
        }
        actions={
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/sandbox">Attack Sandbox</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard">
                Command Center
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        }
      />

      {/* Main Mode Switcher Tabs */}
      <div className="flex items-center gap-1.5 p-1 rounded-lg border border-border bg-muted/40 w-fit">
        <button
          onClick={() => setActiveTab("keys")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            activeTab === "keys"
              ? "bg-card text-foreground border border-border shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Key className="h-3.5 w-3.5" />
          API Keys & Snippets
        </button>
        <button
          onClick={() => setActiveTab("readiness")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            activeTab === "readiness"
              ? "bg-card text-foreground border border-border shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Readiness & Smoke Tests
        </button>
      </div>

      {activeTab === "keys" ? (
        <CustomerApiHub />
      ) : (
        <OnboardingHub
          flow={flow}
          apiOnline={apiOnline}
          wsConnected={wsConnected}
          suitePass={suitePass}
          suiteTotal={suiteTotal}
          caseDetails={caseDetails}
          cases={VALIDATION_CASES}
          activeCaseId={activeCaseId}
          onSelectCase={selectCase}
          batchRunning={batchRunning}
          suiteProgress={suiteProgress}
          scanError={scanError}
          result={lastScan}
          summary={summary}
          firedDetector={firedDetector}
          latencyMs={latencyMs}
          activeCase={activeCase}
          ingestLoading={ingestLoading}
          ingestResult={ingestResult}
          ingestError={ingestError}
          autoRunning={false}
          liveEvents={liveEvents}
          liveLoading={metricsLoading}
          onRunAll={() => void runAllValidations()}
          onIngest={() => void runIngestSmoke()}
          onExport={handleExportJson}
          onExportMarkdown={() => void handleExportMarkdown()}
          onExportPdf={() => void handleExportPdf()}
          exportLoading={exportLoading}
          canExport={canExport}
        />
      )}
    </PageStack>
  );
}
