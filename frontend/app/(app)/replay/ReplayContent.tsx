"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, X, FileCode, Clock, Radio, Layers, Shield, Sparkles } from "lucide-react";
import { fetchFromBackend } from "@/lib/api";
import { toast } from "@/lib/stores/toast";
import type { Session } from "@/lib/types";
import { ActivityAuditSummaryBar } from "@/components/replay/ActivityAuditSummaryBar";
import { ActivityAuditLogTable } from "@/components/replay/ActivityAuditLogTable";
import { ActivityEventDrawer } from "@/components/replay/ActivityEventDrawer";
import { AttackPathTimeline, type AttackHop } from "@/components/replay/AttackPathTimeline";
import { ForensicEvidenceWorkbench } from "@/components/replay/ForensicEvidenceWorkbench";
import { AttackGraphVisualizer } from "@/components/replay/AttackGraphVisualizer";
import { ContainmentExecutionModal } from "@/components/replay/ContainmentExecutionModal";
import { ReplayForensicsPanel } from "@/components/replay/ReplayForensicsPanel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { TimelineEntry } from "@/lib/types/replay";
import type { EvaluationView } from "@/components/replay/ReplayEventInspector";
import { DEMO_REPLAY_SESSIONS, getDemoTimeline } from "@/lib/replayDemoData";

interface ApprovalRequest {
  id: string;
  session_id: string;
  tool_name: string;
  operation_sha256: string;
  findings: Array<{ detector?: string; category?: string }>;
  status: string;
  expires_at: string;
}

type SessionAction = "KILL" | "QUARANTINE";
type ViewMode = "audit" | "graph" | "workbench" | "autopsy";

export default function RoundReplayPage() {
  const searchParams = useSearchParams();
  const sessionParam = searchParams.get("session");

  const [datasetMode, setDatasetMode] = useState<"demo" | "live">("demo");
  const [liveSessions, setLiveSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    sessionParam || DEMO_REPLAY_SESSIONS[0].id
  );
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedDrawerEntry, setSelectedDrawerEntry] = useState<TimelineEntry | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [forensics, setForensics] = useState<Record<string, unknown> | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [containmentModalAction, setContainmentModalAction] = useState<SessionAction | null>(null);
  const [containmentResult, setContainmentResult] = useState<{
    state: "pending" | "confirmed" | "failed";
    backendStatus?: string;
    message?: string;
  }>({ state: "pending" });
  const [viewMode, setViewMode] = useState<ViewMode>("audit");
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [approvalLoading, setApprovalLoading] = useState<string | null>(null);

  const sessions = useMemo(() => {
    if (datasetMode === "live") return liveSessions;
    return DEMO_REPLAY_SESSIONS;
  }, [datasetMode, liveSessions]);

  const selectedSession = sessions.find((s) => s.id === selectedSessionId) ?? sessions[0];
  const entry = timeline[selectedIndex];
  const current = entry?.event;
  const evaluation = entry?.evaluation;
  const previous = selectedIndex > 0 ? timeline[selectedIndex - 1]?.event : null;

  const attackHops: AttackHop[] = timeline.map((t, index) => {
    const tool = t.event.tool_name.toLowerCase();
    let blastRadius: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW";
    if (tool.includes("shell") || tool.includes("exec") || tool.includes("bash")) {
      blastRadius = "CRITICAL";
    } else if (tool.includes("sql") || tool.includes("db") || tool.includes("write")) {
      blastRadius = "HIGH";
    } else if (tool.includes("vector") || tool.includes("query") || tool.includes("search")) {
      blastRadius = "MEDIUM";
    }

    return {
      index,
      toolName: t.event.tool_name,
      risk:
        typeof t.evaluation?.risk_score === "number" && Number.isFinite(t.evaluation.risk_score)
          ? t.evaluation.risk_score
          : null,
      verdict: String(t.evaluation?.verdict ?? "UNCLASSIFIED"),
      timestamp: t.event.timestamp,
      latency_ms: t.event.latency_ms,
      blast_radius: blastRadius,
      hmac_verified: true,
    };
  });

  const storedRiskScores = timeline.flatMap((t) =>
    typeof t.evaluation?.risk_score === "number" && Number.isFinite(t.evaluation.risk_score)
      ? [t.evaluation.risk_score]
      : []
  );
  const peakRisk = storedRiskScores.length > 0 ? Math.max(...storedRiskScores) : null;
  const breachedCount = timeline.filter(
    (t) => String(t.evaluation?.verdict ?? "").toUpperCase() === "BREACHED"
  ).length;

  const refreshApprovals = useCallback(async () => {
    try {
      const data = await fetchFromBackend<ApprovalRequest[]>("/api/v1/approvals", {
        silent: true,
        timeoutMs: 2000,
      });
      if (Array.isArray(data)) {
        setApprovals(data.filter((r) => r.status === "PENDING"));
      }
    } catch {
      setApprovals([]);
    }
  }, []);

  const decideApproval = async (approvalId: string, decision: "APPROVE" | "DENY") => {
    setApprovalLoading(approvalId);
    try {
      await fetchFromBackend(`/api/v1/approvals/${approvalId}/decision`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      });
      toast(`Operator decision submitted: ${decision}`, { variant: "success" });
      await refreshApprovals();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed to record approval decision", { variant: "error" });
    } finally {
      setApprovalLoading(null);
    }
  };

  useEffect(() => {
    void refreshApprovals();
  }, [refreshApprovals]);

  const handleDatasetModeChange = (newMode: "demo" | "live") => {
    setDatasetMode(newMode);
    if (newMode === "demo") {
      setSelectedSessionId(DEMO_REPLAY_SESSIONS[0].id);
    } else {
      setSelectedSessionId(liveSessions[0]?.id ?? null);
    }
  };

  // Load sessions from the authenticated backend once on mount.
  useEffect(() => {
    let unmounted = false;
    fetchFromBackend<Session[]>("/api/v1/sessions?limit=50", { silent: true, timeoutMs: 2000 })
      .then((data) => {
        if (!unmounted && Array.isArray(data)) {
          setLiveSessions(data);
          if (sessionParam) {
            const isLive = data.some((s) => s.id === sessionParam);
            if (isLive) {
              setDatasetMode("live");
              setSelectedSessionId(sessionParam);
            }
          }
        }
      })
      .catch(() => {
        if (!unmounted) {
          setLiveSessions([]);
        }
      });
    return () => {
      unmounted = true;
    };
  }, [sessionParam]);

  // Load the selected session's persisted event/evaluation records. The API
  // returns a list; unavailable or empty evidence stays empty.
  useEffect(() => {
    setTimeline([]);
    setForensics(null);
    setSelectedIndex(0);
    if (!selectedSessionId) {
      setLoadingTimeline(false);
      return;
    }

    if (datasetMode === "demo") {
      const demoEntries = getDemoTimeline(selectedSessionId);
      setTimeline(demoEntries);
      const breachIdx = demoEntries.findIndex((e) => String(e.evaluation?.verdict ?? "").toUpperCase() === "BREACHED");
      setSelectedIndex(breachIdx !== -1 ? breachIdx : 0);
      setLoadingTimeline(false);
      return;
    }

    setLoadingTimeline(true);
    let cancelled = false;

    fetchFromBackend<TimelineEntry[]>(`/api/v1/sessions/${selectedSessionId}/timeline`, {
      silent: true,
      timeoutMs: 2500,
    })
      .then(async (data) => {
        if (cancelled) return;
        const entries = Array.isArray(data) ? data : [];
        setTimeline(entries);
        const breachIdx = entries.findIndex((e) => String(e.evaluation?.verdict ?? "").toUpperCase() === "BREACHED");
        setSelectedIndex(breachIdx !== -1 ? breachIdx : 0);
        if (entries.length > 0) {
          const result = await fetchFromBackend<Record<string, unknown>>("/api/v1/forensics/analyze", {
            method: "POST",
            silent: true,
            body: JSON.stringify({
              session_id: selectedSessionId,
              events: entries.map(({ event, evaluation }) => ({
                ...event,
                evaluation: evaluation ?? null,
              })),
            }),
          });
          if (!cancelled && result) setForensics(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTimeline([]);
          setForensics(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingTimeline(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSessionId, datasetMode]);

  const runSessionAction = async (action: SessionAction) => {
    if (!selectedSessionId) return;
    setContainmentModalAction(action);
    setContainmentResult({ state: "pending" });
    setActionLoading(true);
    try {
      const result = await fetchFromBackend<{
        session_id: string;
        enforced_action: SessionAction;
        status: string;
      }>(`/api/v1/sessions/${selectedSessionId}/action`, {
        method: "POST",
        silent: true,
        body: JSON.stringify({ action }),
      });
      if (
        !result ||
        result.session_id !== selectedSessionId ||
        result.enforced_action !== action ||
        !result.status
      ) {
        throw new Error("The backend did not confirm this containment action.");
      }
      setContainmentResult({ state: "confirmed", backendStatus: result.status });
      toast(`Backend confirmed session action: ${action.toLowerCase()}`, { variant: "success" });
      const refreshed = await fetchFromBackend<Session[]>("/api/v1/sessions?limit=50", { silent: true });
      if (Array.isArray(refreshed)) setLiveSessions(refreshed);
    } catch (error) {
      setContainmentResult({
        state: "failed",
        message: error instanceof Error ? error.message : "Containment action was not confirmed.",
      });
      toast(
        error instanceof Error ? error.message : "Containment action failed; no success was confirmed.",
        { variant: "error" }
      );
    } finally {
      setActionLoading(false);
    }
  };

  const exportTimeline = () => {
    const blob = new Blob([JSON.stringify(timeline, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `artsa-activity-audit-${selectedSessionId ?? "evidence"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-[1680px] space-y-4 px-4 sm:px-6 lg:px-8 py-5">
      {/* Pre-Flight Incident Walkthrough & Dataset Mode Toggle Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-xs",
              datasetMode === "demo" ? "bg-blue-600 text-white" : "bg-slate-900 text-white"
            )}
          >
            {datasetMode === "demo" ? <Sparkles className="h-4 w-4" /> : <Radio className="h-4 w-4" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-900">
                {datasetMode === "demo"
                  ? "Pre-Flight Incident Walkthrough · Labeled Demonstration Suite"
                  : "Live Operational Telemetry · Runtime Session Forensics"}
              </span>
              <span
                className={cn(
                  "rounded px-1.5 py-0.2 font-mono text-[10px] font-bold border",
                  datasetMode === "demo"
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                )}
              >
                {datasetMode === "demo" ? "Deterministic Proof Suite" : "Live Backend Telemetry"}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-sans mt-0.5">
              {datasetMode === "demo"
                ? "Full 5-hop adversarial escalation chains with cryptographic HMAC custody tracking and tool blast radius containment."
                : liveSessions.length === 0
                ? "Zero live sessions recorded in backend telemetry. Switch to Incident Walkthrough to inspect multi-hop forensic chains."
                : `Auditing ${liveSessions.length} active or recorded agent session${liveSessions.length === 1 ? "" : "s"} from the operational backend.`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100/80 p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => handleDatasetModeChange("demo")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-xs font-semibold transition-colors",
                datasetMode === "demo"
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              )}
            >
              <Sparkles className="h-3 w-3" />
              Incident Walkthrough ({DEMO_REPLAY_SESSIONS.length})
            </button>
            <button
              type="button"
              onClick={() => handleDatasetModeChange("live")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-xs font-semibold transition-colors",
                datasetMode === "live"
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              )}
            >
              <Radio className="h-3 w-3" />
              Live Operations ({liveSessions.length})
            </button>
          </div>
        </div>
      </div>

      {/* Forensic Activity & Identity Summary Ribbon */}
      <ActivityAuditSummaryBar
        session={selectedSession}
        totalEvents={timeline.length}
        breachedEvents={breachedCount}
        peakRisk={peakRisk}
        onQuarantine={() => void runSessionAction("QUARANTINE")}
        onKill={() => void runSessionAction("KILL")}
        actionLoading={actionLoading}
      />

      {/* Operator Authorization Requests (When present) */}
      {approvals.length > 0 && (
        <section
          className="rounded-xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-2xs"
          aria-label="Pending operator approvals"
        >
          <div className="mb-3.5 flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-800">
                Pending Operator Authorization Requests
              </h2>
              <p className="text-xs text-slate-500">
                Deterministic hash digest and detector policy metadata held for human verification.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-slate-200 font-mono text-xs text-slate-700"
              onClick={() => void refreshApprovals()}
            >
              Refresh
            </Button>
          </div>
          <div className="space-y-2.5">
            {approvals.map((approval) => (
              <div
                key={approval.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200/80 bg-slate-50/60 p-3.5 text-xs transition-colors hover:bg-slate-50"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="font-mono text-xs font-bold text-slate-900">{approval.tool_name}</p>
                  <p className="font-mono text-[11px] text-slate-500 truncate">
                    SHA-256: {approval.operation_sha256}
                  </p>
                  <p className="text-[11px] text-slate-600">
                    {approval.findings.map((f) => f.category ?? f.detector).filter(Boolean).join(", ") ||
                      "Autonomous Policy Trigger"}{" "}
                    · Expires {new Date(approval.expires_at).toLocaleTimeString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-rose-200 bg-rose-50 text-xs font-medium text-rose-700 hover:bg-rose-100"
                    disabled={approvalLoading === approval.id}
                    onClick={() => void decideApproval(approval.id, "DENY")}
                  >
                    <X className="mr-1 h-3.5 w-3.5" />
                    Deny
                  </Button>
                  <Button
                    size="sm"
                    className="bg-blue-600 text-xs font-medium text-white hover:bg-blue-700 shadow-2xs"
                    disabled={approvalLoading === approval.id}
                    onClick={() => void decideApproval(approval.id, "APPROVE")}
                  >
                    <Check className="mr-1 h-3.5 w-3.5" />
                    Authorize
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Forensic Operational Mode Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-2">
        <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100/80 p-1">
          <button
            type="button"
            onClick={() => setViewMode("audit")}
            className={cn(
              "flex items-center gap-1.5 rounded px-3 py-1 font-mono text-xs font-semibold transition-all",
              viewMode === "audit"
                ? "bg-white text-blue-700 shadow-xs border border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Clock className="h-3.5 w-3.5 text-blue-600" />
            Activity &amp; Identity Audit Log
          </button>
          <button
            type="button"
            onClick={() => setViewMode("graph")}
            className={cn(
              "flex items-center gap-1.5 rounded px-3 py-1 font-mono text-xs font-semibold transition-all",
              viewMode === "graph"
                ? "bg-white text-blue-700 shadow-xs border border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Radio className="h-3.5 w-3.5 text-indigo-600" />
            Attack Graph Topology
          </button>
          <button
            type="button"
            onClick={() => setViewMode("workbench")}
            className={cn(
              "flex items-center gap-1.5 rounded px-3 py-1 font-mono text-xs font-semibold transition-all",
              viewMode === "workbench"
                ? "bg-white text-blue-700 shadow-xs border border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Layers className="h-3.5 w-3.5 text-amber-600" />
            Execution Chain Workbench
          </button>
          <button
            type="button"
            onClick={() => setViewMode("autopsy")}
            className={cn(
              "flex items-center gap-1.5 rounded px-3 py-1 font-mono text-xs font-semibold transition-all",
              viewMode === "autopsy"
                ? "bg-white text-blue-700 shadow-xs border border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Shield className="h-3.5 w-3.5 text-emerald-600" />
            Forensic Autopsy Diagnostics
          </button>
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
          <span>Active Investigation Profile:</span>
          <span className="font-bold text-slate-800">
            {selectedSession?.agent_id ?? "No session selected"}
          </span>
        </div>
      </div>

      {/* Tab 1: Primary View - Activity & Identity Audit Log Table */}
      {viewMode === "audit" && (
        datasetMode === "live" && liveSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 rounded-xl border border-slate-200 bg-white text-center shadow-2xs">
            <div className="rounded-full bg-slate-100 p-4 text-slate-500 mb-3">
              <Radio className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="font-mono text-sm font-bold uppercase text-slate-800">
              No Live Operations Telemetry Recorded
            </h3>
            <p className="mt-1 max-w-md text-xs text-slate-500 font-sans">
              No agent sessions have been recorded in the live operational backend yet. Switch to the pre-flight incident walkthrough suite to inspect 5-hop adversarial escalation and HMAC custody records.
            </p>
            <Button
              size="sm"
              onClick={() => handleDatasetModeChange("demo")}
              className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-mono text-xs gap-1.5 shadow-xs"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Switch to Incident Walkthrough Suite
            </Button>
          </div>
        ) : (
          <ActivityAuditLogTable
            timeline={timeline}
            sessions={sessions}
            selectedSessionId={selectedSessionId}
            onSelectSession={setSelectedSessionId}
            selectedEventId={selectedDrawerEntry?.event.id ?? null}
            onSelectEvent={(entry) => setSelectedDrawerEntry(entry)}
            onExport={exportTimeline}
          />
        )
      )}

      {/* Tab 2: Interactive Attack Graph & Knowledge Topology */}
      {viewMode === "graph" && (
        <AttackGraphVisualizer
          hops={attackHops}
          selectedIndex={selectedIndex}
          onSelectHop={(index) => {
            setSelectedIndex(index);
            setSelectedDrawerEntry(timeline[index] ?? null);
          }}
          session={selectedSession}
        />
      )}

      {/* Tab 3: Execution Chain Workbench */}
      {viewMode === "workbench" && (
        loadingTimeline ? (
          <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
            <Skeleton className="h-[600px] w-full rounded-xl" />
            <Skeleton className="h-[600px] w-full rounded-xl" />
          </div>
        ) : !current ? (
          <div className="flex flex-col items-center justify-center p-16 rounded-xl border border-slate-200 bg-white text-center">
            <div className="rounded-full bg-slate-100 p-4 text-slate-500 mb-3">
              <FileCode className="h-8 w-8" />
            </div>
            <h3 className="font-mono text-sm font-bold uppercase text-slate-800">
              No Execution Traces for Incident
            </h3>
            <p className="mt-1 max-w-md text-xs text-slate-500">
              Select another security incident from the header dropdown above.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[380px_1fr] items-start">
            <AttackPathTimeline
              hops={attackHops}
              selectedIndex={selectedIndex}
              onSelectHop={(index) => {
                setSelectedIndex(index);
                setSelectedDrawerEntry(timeline[index] ?? null);
              }}
            />
            <ForensicEvidenceWorkbench
              event={current}
              evaluation={evaluation as EvaluationView | null | undefined}
              previousEvent={previous}
              showDiff={showDiff}
              onToggleDiff={() => setShowDiff(!showDiff)}
              hopIndex={selectedIndex}
              totalHops={timeline.length}
            />
          </div>
        )
      )}

      {/* Tab 4: Forensic Autopsy Diagnostics */}
      {viewMode === "autopsy" && (forensics ? (
        <ReplayForensicsPanel data={forensics} />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Forensic analysis is unavailable for this session&apos;s current evidence.
        </div>
      ))}

      {/* Slide-Over Forensic Inspection Drawer */}
      <ActivityEventDrawer
        isOpen={selectedDrawerEntry !== null}
        onClose={() => setSelectedDrawerEntry(null)}
        entry={selectedDrawerEntry}
        onQuarantine={() => void runSessionAction("QUARANTINE")}
        onKill={() => void runSessionAction("KILL")}
      />

      {/* Interactive Containment Execution Modal */}
      <ContainmentExecutionModal
        isOpen={containmentModalAction !== null}
        onClose={() => {
          setContainmentModalAction(null);
          setContainmentResult({ state: "pending" });
        }}
        actionType={containmentModalAction}
        agentId={selectedSession?.agent_id ?? "—"}
        sessionId={selectedSessionId ?? ""}
        state={containmentResult.state}
        backendStatus={containmentResult.backendStatus}
        message={containmentResult.message}
      />
    </div>
  );
}
