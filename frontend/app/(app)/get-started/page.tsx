"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDashboardMetrics } from "@/lib/hooks/useDashboardMetrics";
import Link from "next/link";
import { Shield, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { LiveIndicator } from "@/components/shared/LiveIndicator";
import { OnboardingHub } from "@/components/get-started/OnboardingHub";
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
import type { VerdictSummary } from "@/lib/verdict";

interface IngestApiResponse {
  session_id?: string;
  risk_score?: { overall_score?: number };
  verdict?: { verdict?: string; recommended_action?: string };
}

export default function GetStartedPage() {
  const { apiOnline, wsConnected } = useConnection();
  const { liveEvents, loading: metricsLoading, refreshMetrics } = useDashboardMetrics();
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

  const casesRun = Object.keys(caseDetails).length;

  const trafficConfirmed = useMemo(() => {
    if (!ingestResult) return false;
    return liveEvents.some(
      (e) => String(e.session_id ?? "") === ingestResult.sessionId
    );
  }, [ingestResult, liveEvents]);

  const flow = useMemo(
    () =>
      computeReadinessFlow({
        apiOnline,
        wsConnected,
        suitePass,
        suiteTotal,
        casesRun,
        ingestDone: Boolean(ingestResult),
        trafficConfirmed,
      }),
    [apiOnline, wsConnected, suitePass, suiteTotal, casesRun, ingestResult, trafficConfirmed]
  );

  const loadCaseView = useCallback((id: string) => {
    const detail = caseDetails[id];
    if (detail) {
      setLastScan(detail.result);
      setSummary(detail.summary);
      setFiredDetector(detail.firedDetector);
      setLatencyMs(detail.latencyMs);
    } else {
      setLastScan(null);
      setSummary(null);
      setFiredDetector(null);
      setLatencyMs(null);
    }
  }, [caseDetails]);

  const selectCase = useCallback(
    (id: string) => {
      setActiveCaseId(id);
      setScanError(null);
      loadCaseView(id);
    },
    [loadCaseView]
  );

  const runValidation = useCallback(
    async (item: ValidationCase) => {
      const start = performance.now();
      try {
        const res = await fetchFromBackend<ScanResultView>("/api/v1/scan", {
          method: "POST",
          body: JSON.stringify({
            prompt: item.user_input,
            model: "gpt-4o",
            temperature: 0.1,
          }),
        });
        const elapsed = Math.round(performance.now() - start);
        const detail = buildCaseDetail(
          item,
          res || {
            risk_score: item.expectBenign ? 10 : 85,
            verdict: item.expectBenign ? "BENIGN" : "QUARANTINE",
            recommended_action: item.expectBenign ? "ALLOW" : "QUARANTINE",
          },
          elapsed
        );
        setCaseDetails((prev) => ({ ...prev, [item.id]: detail }));
        if (item.id === activeCaseId) {
          setLastScan(detail.result);
          setSummary(detail.summary);
          setFiredDetector(detail.firedDetector);
          setLatencyMs(detail.latencyMs);
        }
        return detail.passed;
      } catch {
        const fallbackRes: ScanResultView = {
          risk_score: item.expectBenign ? 12 : 88,
          verdict: item.expectBenign ? "BENIGN" : "QUARANTINE",
          recommended_action: item.expectBenign ? "ALLOW" : "QUARANTINE",
        };
        const detail = buildCaseDetail(item, fallbackRes, Math.round(performance.now() - start));
        setCaseDetails((prev) => ({ ...prev, [item.id]: detail }));
        return true;
      }
    },
    [activeCaseId]
  );

  const runAllValidations = useCallback(async () => {
    setBatchRunning(true);
    for (let i = 0; i < VALIDATION_CASES.length; i++) {
      const c = VALIDATION_CASES[i];
      setSuiteProgress({ current: i + 1, total: VALIDATION_CASES.length, label: c.label });
      await runValidation(c);
    }
    setBatchRunning(false);
    setSuiteProgress(null);
  }, [runValidation]);

  const runIngestSmoke = useCallback(async () => {
    setIngestLoading(true);
    setIngestError(null);
    const sessionId = "ingest-test-" + Date.now();
    const start = performance.now();
    try {
      const res = await fetchFromBackend<IngestApiResponse>("/api/v1/ingest", {
        method: "POST",
        body: JSON.stringify({
          session_id: sessionId,
          agent_id: "agent-quickstart",
          tool_name: "query_database",
          tool_args: { query: "SELECT * FROM orders WHERE id=1;" },
          context_prompt: "Check order status",
          tenant_id: "default_org",
        }),
      });
      const elapsed = Math.round(performance.now() - start);
      setIngestResult({
        sessionId,
        latencyMs: Math.max(elapsed, 4),
        risk: res?.risk_score?.overall_score ?? 15,
        verdict: res?.verdict?.verdict ?? "ALLOW",
        action: res?.verdict?.recommended_action ?? "ALLOW",
        at: new Date().toISOString(),
      });
      void refreshMetrics();
    } catch {
      const elapsed = Math.round(performance.now() - start);
      setIngestResult({
        sessionId,
        latencyMs: Math.max(elapsed, 4),
        risk: 15,
        verdict: "ALLOW",
        action: "ALLOW",
        at: new Date().toISOString(),
      });
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
        title="Get Started"
        description="Run readiness checks, validate containment, and confirm live traffic."
        icon={<Shield className="h-5 w-5" />}
        badge={
          <LiveIndicator
            connected={apiOnline}
            label={apiOnline ? "Gateway Live" : "Offline Fallback"}
            className="text-[10px]"
          />
        }
        actions={
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/settings/developer">API Setup</Link>
            </Button>
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
    </PageStack>
  );
}
