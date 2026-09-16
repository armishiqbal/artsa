"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import type { CampaignListItem } from "@/lib/hooks/useCampaigns";
import type { SixAgentName } from "@/lib/commandCenterOps";
import {
  DEFAULT_DETECTION_SERIES,
  DEFAULT_KPIS,
  LIVE_ROUNDS,
  LIVE_ROUND_MS,
  getSecurityEventForRound,
  logWindow,
  nextRoundIndex,
  type AgentLiveState,
  type AsiBar,
  type AttackTimelineStep,
  type DetectionHistoryPoint,
  type LiveRound,
  type PromptHighlight,
  type PromptSpan,
  type VerdictItem,
  type VerdictTone,
} from "./prototype/liveRounds";
import { CommandCenterDetectionChart } from "./CommandCenterDetectionChart";
import { CommandCenterPromptAnalysis } from "./CommandCenterPromptAnalysis";
import { CommandCenterOpsSplit } from "./CommandCenterOpsSplit";
import { CommandCenterCampaignContext } from "./context/CommandCenterCampaignContext";
import { CommandCenterSecurityPosture } from "./posture/CommandCenterSecurityPosture";
import { CommandCenterInteractionMap } from "./interaction/CommandCenterInteractionMap";
import { CommandCenterAttackTimeline } from "./timeline/CommandCenterAttackTimeline";
import {
  CommandCenterInspectorDrawer,
  type InspectorSelection,
} from "./inspector/CommandCenterInspectorDrawer";
import {
  CommandCenterConfirmationModal,
  type OperatorActionType,
} from "./controls/CommandCenterConfirmationModal";
import { AlertOctagon, Ban } from "lucide-react";
import { CommandCenterOperatorToolbar } from "./controls/CommandCenterOperatorToolbar";
import { CommandCenterAsiModal } from "./taxonomy/CommandCenterAsiModal";
import { CommandCenterVerdictsDeck } from "./verdicts/CommandCenterVerdictsDeck";
import type { LiveOpsState, OperatorActionResult } from "@/lib/hooks/useCommandCenterLiveOps";

export interface CommandCenterFloorProps {
  events: Array<Record<string, unknown>>;
  campaigns: CampaignListItem[];
  apiOnline: boolean;
  wsConnected: boolean;
  liveOps?: LiveOpsState;
  onKillSession?: (sessionId: string) => Promise<OperatorActionResult>;
  onQuarantineAgent?: (sessionId: string) => Promise<OperatorActionResult>;
  onRefreshLiveOps?: () => void;
}

export function CommandCenterFloor({
  events,
  campaigns,
  apiOnline,
  wsConnected,
  liveOps,
  onKillSession,
  onQuarantineAgent,
  onRefreshLiveOps,
}: CommandCenterFloorProps) {
  const [roundIdx, setRoundIdx] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const isLiveMode = Boolean(
    liveOps &&
    liveOps.telemetryMode !== "SIMULATION" &&
    liveOps.telemetryMode !== "DISCONNECTED" &&
    (liveOps.events.length > 0 || (liveOps.currentCampaign && liveOps.currentCampaign.status === "RUNNING"))
  );

  // Inspector & Modal dialog states
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorSelection, setInspectorSelection] = useState<InspectorSelection | null>(null);

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmActionType, setConfirmActionType] = useState<OperatorActionType>(null);
  const [confirmTargetName, setConfirmTargetName] = useState<string>("Target Agent");

  const [asiModalOpen, setAsiModalOpen] = useState(false);
  const [lastOperatorAction, setLastOperatorAction] = useState<string | null>(null);

  // Automatic round progression for simulation mode ("the whole page moves together each round")
  useEffect(() => {
    if (isPaused || isLiveMode) return;
    const id = window.setInterval(() => {
      setRoundIdx((prev) => nextRoundIndex(prev, LIVE_ROUNDS.length));
    }, LIVE_ROUND_MS);
    return () => window.clearInterval(id);
  }, [isPaused, isLiveMode]);

  // Operator Action Handlers
  const handleRequestOperatorAction = useCallback(
    (actionType: OperatorActionType, targetName?: string) => {
      setConfirmActionType(actionType);
      setConfirmTargetName(targetName || "Target Agent");
      setConfirmModalOpen(true);
    },
    []
  );

  const handleConfirmAction = useCallback(
    async (actionType: string, targetName: string) => {
      const targetSessionId = liveOps?.currentSession || "RUN-00182";

      if (actionType === "KILL_SESSION") {
        setIsPaused(true);
        if (onKillSession) {
          try {
            const result = await onKillSession(targetSessionId);
            if (result.success) {
              setLastOperatorAction(
                `Session ${targetSessionId} terminated by operator (HTTP ${result.statusCode ?? 200}: ${result.data?.status || "severed"}).`
              );
            } else {
              setLastOperatorAction(`KILL action failed on session ${targetSessionId}: ${result.error || "Server rejected request"}`);
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setLastOperatorAction(`KILL action error: ${msg}`);
          }
        } else {
          setLastOperatorAction(`Session terminated by operator. Live channels severed.`);
        }
      } else if (actionType === "QUARANTINE_AGENT") {
        if (onQuarantineAgent) {
          try {
            const result = await onQuarantineAgent(targetSessionId);
            if (result.success) {
              setLastOperatorAction(
                `${targetName} quarantined on session ${targetSessionId} (HTTP ${result.statusCode ?? 200}: ${result.data?.status || "contained"}).`
              );
            } else {
              setLastOperatorAction(`QUARANTINE action failed on ${targetName}: ${result.error || "Server rejected request"}`);
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setLastOperatorAction(`QUARANTINE action error: ${msg}`);
          }
        } else {
          setLastOperatorAction(`${targetName} quarantined. Tool permissions revoked.`);
        }
      } else if (actionType === "BLOCK_TOOL") {
        setLastOperatorAction(`Tool "${targetName}" blocked across active agents.`);
      } else if (actionType === "DEPLOY_MITIGATION") {
        setLastOperatorAction(`Mitigation patch deployed to runtime enforcement layer.`);
      }
    },
    [liveOps, onKillSession, onQuarantineAgent]
  );

  // Keyboard shortcuts (Capability 12: Space to pause/resume, ArrowRight to step, Escape to close drawer/modal)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === "Escape") {
        if (confirmModalOpen) {
          setConfirmModalOpen(false);
          e.preventDefault();
        } else if (asiModalOpen) {
          setAsiModalOpen(false);
          e.preventDefault();
        } else if (inspectorOpen) {
          setInspectorOpen(false);
          e.preventDefault();
        }
      } else if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        setIsPaused((prev) => !prev);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setRoundIdx((prev) => nextRoundIndex(prev, LIVE_ROUNDS.length));
      } else if ((e.key === "K" || e.key === "k") && e.shiftKey) {
        e.preventDefault();
        handleRequestOperatorAction("KILL_SESSION");
      } else if ((e.key === "Q" || e.key === "q") && e.shiftKey) {
        e.preventDefault();
        handleRequestOperatorAction("QUARANTINE_AGENT", "Target Agent");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [confirmModalOpen, asiModalOpen, inspectorOpen, handleRequestOperatorAction]);

  const simulationRound = LIVE_ROUNDS[roundIdx] ?? LIVE_ROUNDS[0]!;

  const activeRound: LiveRound = useMemo(() => {
    if (!isLiveMode || !liveOps) {
      return simulationRound;
    }

    const latestEvent = liveOps.events[0];
    const liveRoundNumber =
      liveOps.currentRound ??
      (latestEvent?.roundId ? parseInt(latestEvent.roundId.replace(/\D/g, ""), 10) || 1 : 1);

    const agentMap: Record<SixAgentName, AgentLiveState> = {
      Research: "idle",
      Curator: "idle",
      "Red Team": "idle",
      Target: "idle",
      Judge: "idle",
      Defender: "idle",
    };
    const latencies: Partial<Record<SixAgentName, number | null>> = {};

    for (const ag of liveOps.agents) {
      const roleLower = (ag.role || ag.agentId).toLowerCase();
      let matchedName: SixAgentName | null = null;
      if (roleLower.includes("red")) matchedName = "Red Team";
      else if (roleLower.includes("research")) matchedName = "Research";
      else if (roleLower.includes("curat")) matchedName = "Curator";
      else if (roleLower.includes("target")) matchedName = "Target";
      else if (roleLower.includes("judge")) matchedName = "Judge";
      else if (roleLower.includes("defend")) matchedName = "Defender";

      if (matchedName) {
        agentMap[matchedName] = (ag.state === "not_wired" ? "not wired" : ag.state) as AgentLiveState;
        latencies[matchedName] = ag.latencyMs;
      }
    }

    // Convert live events to ASI bars
    const bars: AsiBar[] = [];
    for (const ev of liveOps.events.slice(0, 4)) {
      if (ev.threatCode) {
        bars.push({
          code: ev.threatCode,
          label: ev.threatCode === "ASI01" ? "Goal Hijack" : ev.threatCode === "ASI02" ? "Tool Misuse" : ev.eventType,
          pct: ev.confidence != null ? Math.round(ev.confidence * 100) : (ev.severity === "CRITICAL" ? 92 : ev.severity === "HIGH" ? 75 : 40),
          tone: ev.severity === "CRITICAL" || ev.severity === "HIGH" ? "alert" : "warn",
        });
      }
    }
    if (bars.length === 0) {
      bars.push(...simulationRound.bars);
    }

    // Convert live events to verdicts
    const verdicts: VerdictItem[] = [];
    for (const ev of liveOps.events.slice(0, 3)) {
      const targetLower = ev.targetAgent.toLowerCase();
      const agentRole: VerdictItem["agent"] =
        targetLower.includes("judge") ? "Judge" :
        targetLower.includes("defend") ? "Defender" : "Target";
      const vLower = ev.verdict.toLowerCase();
      const tone: VerdictTone =
        vLower.includes("quarantin") || vLower.includes("contain") || vLower.includes("pass") ? "ok" :
        vLower.includes("block") || ev.severity === "CRITICAL" ? "warn" : "pending";
      verdicts.push({
        agent: agentRole,
        detail: ev.verdict || ev.mitigation || "Audited",
        tone,
      });
    }
    if (verdicts.length === 0) {
      verdicts.push(...simulationRound.verdicts);
    }

    const highlights: PromptHighlight[] = [];
    if (latestEvent?.payload) {
      const p = latestEvent.payload;
      if (p.toLowerCase().includes("ignore") || p.toLowerCase().includes("override") || p.toLowerCase().includes("bypass")) {
        const match = p.match(/(?:ignore|override|bypass)[^\n,.]*/i);
        if (match) {
          highlights.push({ text: match[0], tone: "inject" });
        }
      }
    }

    return {
      round: liveRoundNumber,
      from: latestEvent?.sourceAgent || simulationRound.from,
      to: latestEvent?.targetAgent || simulationRound.to,
      prompt: latestEvent?.payload || "Live operational monitoring active. Awaiting adversarial traffic...",
      highlights: highlights.length > 0 ? highlights : simulationRound.highlights,
      bars,
      agents: agentMap,
      latencies,
      verdicts,
      log: latestEvent ? `[${latestEvent.sourceAgent} -> ${latestEvent.targetAgent}] ${latestEvent.threatCode || latestEvent.eventType}: ${latestEvent.verdict || latestEvent.mitigation}` : simulationRound.log,
      statusBadge: liveOps.telemetryMode === "LIVE" ? "LIVE TELEMETRY" : liveOps.telemetryMode === "STALE" ? "STALE TELEMETRY" : "DISCONNECTED",
      badgeTone: liveOps.telemetryMode === "LIVE" ? "live" : liveOps.telemetryMode === "STALE" ? "warning" : "error",
      event: latestEvent
        ? {
            eventId: latestEvent.eventId,
            campaignId: latestEvent.campaignId || liveOps.currentCampaign?.id || "live_campaign",
            sessionId: latestEvent.sessionId || liveOps.currentSession || "live_session",
            roundId: latestEvent.roundId || `R${liveRoundNumber}`,
            timestamp: latestEvent.timestamp,
            sourceAgent: latestEvent.sourceAgent,
            targetAgent: latestEvent.targetAgent,
            threatCode: latestEvent.threatCode || "ASI01",
            severity: latestEvent.severity === "CRITICAL" ? "critical" : latestEvent.severity === "HIGH" ? "warning" : "info",
            payload: latestEvent.payload,
            detectionSignal: latestEvent.detectionSignal,
            verdict: latestEvent.verdict,
            mitigation: latestEvent.mitigation,
            traceId: latestEvent.traceId,
            confidence: latestEvent.confidence != null ? Math.round(latestEvent.confidence * 100) : 90,
          }
        : undefined,
    };
  }, [isLiveMode, liveOps, simulationRound]);

  const logLines = useMemo(() => {
    if (!isLiveMode) {
      return logWindow(LIVE_ROUNDS, roundIdx, 5);
    }
    if (!liveOps || liveOps.events.length === 0) {
      return ["Awaiting live security telemetry events from backend bus..."];
    }
    return liveOps.events.slice(0, 6).map((e) => {
      const timeStr = e.timestamp ? new Date(e.timestamp).toLocaleTimeString() : "";
      return `[${timeStr}] [${e.sourceAgent} -> ${e.targetAgent}] ${e.threatCode || e.eventType}: ${e.verdict || e.payload.slice(0, 60)}`;
    });
  }, [isLiveMode, liveOps, roundIdx]);

  const circuitBreakerOpen = useMemo(() => {
    if (liveOps?.circuitBreaker?.status === "tripped") {
      return true;
    }
    return events.some((event) => {
      const categories = event.categories;
      return Array.isArray(categories) && categories.some((category) => String(category).startsWith("ASI08"));
    });
  }, [liveOps, events]);

  // Derived or default KPIs matching screenshots & live metrics
  const kpiData = useMemo(() => {
    if (!isLiveMode || !liveOps) {
      if (activeRound.kpis) return activeRound.kpis;
      const liveAlerts = events.filter((e) => {
        const risk = Number(e.risk_score ?? 0);
        return risk >= 50 || /QUARANTINE|BREACH|BLOCK|KILL|DENY/i.test(String(e.verdict ?? ""));
      }).length;

      return {
        trustChain: DEFAULT_KPIS.trustChain,
        detectionRate: DEFAULT_KPIS.detectionRate,
        disagreementRate: DEFAULT_KPIS.disagreementRate,
        openAlerts: liveAlerts > 0 ? liveAlerts : DEFAULT_KPIS.openAlerts,
      };
    }

    const m = liveOps.metrics;
    const criticalEventsCount = liveOps.events.filter(
      (e) => e.severity === "CRITICAL" || e.verdict.toLowerCase().includes("quarantin") || e.verdict.toLowerCase().includes("block")
    ).length;

    return {
      trustChain: m?.containmentRate != null ? Math.round(m.containmentRate * 100) : DEFAULT_KPIS.trustChain,
      detectionRate: m?.detectionRate != null ? Math.round(m.detectionRate * 100) : (m?.recall != null ? Math.round(m.recall * 100) : DEFAULT_KPIS.detectionRate),
      disagreementRate: m?.falsePositiveRate != null ? Math.round(m.falsePositiveRate * 100) : DEFAULT_KPIS.disagreementRate,
      openAlerts: criticalEventsCount > 0 ? criticalEventsCount : (m?.falsePositive ?? DEFAULT_KPIS.openAlerts),
    };
  }, [isLiveMode, liveOps, activeRound, events]);

  const overallRiskOverride: "CRITICAL" | "ELEVATED" | "NOMINAL" | undefined = useMemo(() => {
    if (!isLiveMode || !liveOps) return undefined;
    if (liveOps.events.some((e) => e.severity === "CRITICAL")) return "CRITICAL";
    if (liveOps.events.some((e) => e.severity === "HIGH")) return "ELEVATED";
    return "NOMINAL";
  }, [isLiveMode, liveOps]);

  // Chart series: static baseline + adaptive curve with points matching screenshot
  const chartSeries: DetectionHistoryPoint[] = useMemo(() => {
    if (isLiveMode && liveOps?.metrics?.adaptiveDetection != null && liveOps?.metrics?.baselineDetection != null) {
      const baseSeries = [...DEFAULT_DETECTION_SERIES];
      const roundKey = `R${activeRound.round}`;
      const existingIdx = baseSeries.findIndex((p) => p.round === roundKey);
      const livePoint: DetectionHistoryPoint = {
        round: roundKey,
        artsa: Math.round(liveOps.metrics.adaptiveDetection * 100),
        baseline: Math.round(liveOps.metrics.baselineDetection * 100),
      };
      if (existingIdx >= 0) {
        baseSeries[existingIdx] = livePoint;
      } else {
        baseSeries.push(livePoint);
      }
      return baseSeries;
    }
    return DEFAULT_DETECTION_SERIES;
  }, [isLiveMode, liveOps, activeRound.round]);

  // Inspector opener helpers
  const inspectAgent = useCallback((agent: SixAgentName) => {
    const sec = getSecurityEventForRound(activeRound, roundIdx);
    const state = activeRound.agents[agent] ?? "idle";
    const isUnderAttack = state === "active" || state === "responding";

    setInspectorSelection({
      kind: "agent",
      title: `${agent === "Red Team" ? "Red Team" : agent} Telemetry`,
      threatCode: sec.threatCode,
      severity: isUnderAttack ? "critical" : state === "contained" ? "warning" : "info",
      sourceAgent: agent,
      targetAgent: activeRound.to,
      evidence: activeRound.prompt,
      detectionSignal: sec.detectionSignal,
      action: state === "contained" ? "CONTAINED" : isUnderAttack ? "PROBING" : "NOMINAL",
      confidence: sec.confidence,
      round: activeRound.round,
      timestamp: sec.timestamp,
      eventId: sec.eventId,
      traceId: sec.traceId,
      fields: [
        { label: "Agent Status", value: state },
        { label: "Hop Latency", value: activeRound.latencies?.[agent] != null ? `${activeRound.latencies[agent]}ms` : "N/A" },
        {
          label: "Role",
          value:
            agent === "Red Team"
              ? "Adversarial Generator"
              : agent === "Target"
                ? "Evaluated Stack"
                : agent === "Defender"
                  ? "Containment Policy"
                  : agent === "Judge"
                    ? "Breach Scorer"
                    : "Pipeline Hop",
        },
      ],
    });
    setInspectorOpen(true);
  }, [activeRound, roundIdx]);

  const inspectThreat = useCallback((bar: AsiBar) => {
    const sec = getSecurityEventForRound(activeRound, roundIdx);
    const isAlert = bar.tone === "alert" || bar.pct >= 75;

    setInspectorSelection({
      kind: "threat",
      title: `${bar.code} · ${bar.label.toUpperCase()}`,
      threatCode: bar.code,
      severity: isAlert ? "critical" : "warning",
      sourceAgent: activeRound.from,
      targetAgent: activeRound.to,
      evidence: activeRound.prompt,
      detectionSignal: sec.detectionSignal,
      action: sec.verdict,
      confidence: bar.pct,
      round: activeRound.round,
      timestamp: sec.timestamp,
      eventId: sec.eventId,
      traceId: sec.traceId,
      fields: [
        { label: "Severity Score", value: `${bar.pct}%` },
        { label: "Threat Tag", value: bar.code },
        { label: "Trigger State", value: bar.tone },
      ],
    });
    setInspectorOpen(true);
  }, [activeRound, roundIdx]);

  const inspectHighlight = useCallback((span: PromptSpan) => {
    const sec = getSecurityEventForRound(activeRound, roundIdx);
    const isInject = span.tone === "inject";

    setInspectorSelection({
      kind: "highlight",
      title: `Payload Token: "${span.text}"`,
      threatCode: isInject ? "ASI01" : "ASI02",
      severity: isInject ? "critical" : "warning",
      sourceAgent: activeRound.from,
      targetAgent: activeRound.to,
      evidence: activeRound.prompt,
      detectionSignal: isInject
        ? "Direct Prompt Injection Pattern (Jailbreak Signature)"
        : "Tool Schema Parameter Inspection",
      action: sec.verdict,
      confidence: sec.confidence,
      round: activeRound.round,
      timestamp: sec.timestamp,
      eventId: sec.eventId,
      traceId: sec.traceId,
    });
    setInspectorOpen(true);
  }, [activeRound, roundIdx]);

  const inspectStatusBadge = useCallback(() => {
    const sec = getSecurityEventForRound(activeRound, roundIdx);
    setInspectorSelection({
      kind: "threat",
      title: activeRound.statusBadge ?? `Round ${activeRound.round} Telemetry Status`,
      threatCode: activeRound.bars[0]?.code ?? "HMAC",
      severity: activeRound.badgeTone === "error" ? "critical" : "info",
      sourceAgent: activeRound.from,
      targetAgent: activeRound.to,
      evidence: activeRound.prompt,
      detectionSignal: sec.detectionSignal,
      action: sec.verdict,
      confidence: sec.confidence,
      round: activeRound.round,
      timestamp: sec.timestamp,
      eventId: sec.eventId,
      traceId: sec.traceId,
    });
    setInspectorOpen(true);
  }, [activeRound, roundIdx]);

  const inspectLogLine = useCallback((line: string) => {
    const sec = getSecurityEventForRound(activeRound, roundIdx);
    setInspectorSelection({
      kind: "log",
      title: "Mission Log Event",
      evidence: line,
      round: activeRound.round,
      timestamp: sec.timestamp,
      eventId: sec.eventId,
      traceId: sec.traceId,
      action: "AUDITED",
      detectionSignal: "Event Stream Ingest",
      severity: line.includes("FAIL") || line.includes("breach") ? "critical" : "info",
    });
    setInspectorOpen(true);
  }, [activeRound, roundIdx]);

  const inspectTimelineStep = useCallback((step: AttackTimelineStep) => {
    setInspectorSelection({
      kind: "step",
      title: `${step.label} · ${step.whatHappened}`,
      threatCode: step.threatCode,
      severity:
        step.status === "blocked" || step.status === "breach"
          ? "critical"
          : step.status === "suspicious"
            ? "warning"
            : "info",
      sourceAgent: step.agentFrom,
      targetAgent: step.agentTo,
      evidence: activeRound.prompt,
      detectionSignal: step.whatDetectedIt,
      action: step.actionTaken,
      round: step.round,
      timestamp: step.when,
      eventId: step.eventId,
      traceId: step.traceId,
    });
    setInspectorOpen(true);
  }, [activeRound]);

  const inspectAsiCode = useCallback((code: string) => {
    setInspectorSelection({
      kind: "asi",
      title: `OWASP ${code} Classification`,
      threatCode: code,
      severity:
        code === "ASI01" || code === "ASI02" || code === "ASI06"
          ? "critical"
          : "warning",
      detectionSignal: "OWASP Agentic Security Matrix",
      action: "CLASSIFIED",
      round: activeRound.round,
      timestamp: new Date().toISOString(),
      eventId: `asi_${code.toLowerCase()}`,
      traceId: `trace_asi_${code.toLowerCase()}`,
    });
    setInspectorOpen(true);
  }, [activeRound]);


  return (
    <div
      className="min-h-screen w-full bg-background text-foreground flex flex-col items-center select-none transition-colors"
    >
      {/* Sticky Tactical HUD Container (P1 & P3) */}
      <header className="sticky top-0 z-30 w-full bg-background/95 backdrop-blur-md border-b border-border/80 shadow-xs">
        <div className="w-full max-w-[1520px] mx-auto px-4 sm:px-6 py-3 space-y-3">
          <h1 className="text-sm font-semibold tracking-tight text-foreground">Command Center</h1>
          {circuitBreakerOpen ? (
            <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
              Circuit breaker open — cascading failures contained.
            </p>
          ) : null}
          {/* Top Operational Identity + Global Emergency Containment Rail (P4) */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CommandCenterCampaignContext
              campaignName={
                isLiveMode
                  ? (liveOps?.currentCampaign?.name || "NO ACTIVE CAMPAIGN")
                  : (liveOps?.currentCampaign?.name || campaigns[0]?.name || "ARTSA-REDTEAM-042")
              }
              sessionId={
                isLiveMode
                  ? (liveOps?.currentSession || "NO ACTIVE SESSION")
                  : (liveOps?.currentSession || "RUN-00182")
              }
              targetName="Enterprise Agent Stack"
              roundNumber={isLiveMode ? (liveOps?.currentRound ?? activeRound.round) : activeRound.round}
              apiOnline={apiOnline}
              wsConnected={wsConnected}
              isPaused={isPaused}
              telemetryState={liveOps ? liveOps.telemetryMode : undefined}
              className="border-b-0 pb-0 flex-1 min-w-[280px]"
            />

            {/* Global Emergency Containment Rail */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleRequestOperatorAction("QUARANTINE_AGENT", "Target Agent")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/60 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 transition-colors shadow-xs cursor-pointer"
                title="Quarantine Target Agent (Shift + Q)"
              >
                <Ban className="h-3.5 w-3.5" />
                <span>QUARANTINE</span>
                <kbd className="hidden sm:inline rounded bg-rose-500/20 px-1 py-0.2 text-[9px] font-mono">⇧Q</kbd>
              </button>

              <button
                type="button"
                onClick={() => handleRequestOperatorAction("KILL_SESSION")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-600/80 bg-red-600/20 hover:bg-red-600/30 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-red-500 dark:text-red-400 transition-colors shadow-xs cursor-pointer"
                title="Emergency Kill Session (Shift + K)"
              >
                <AlertOctagon className="h-3.5 w-3.5" />
                <span>KILL SESSION</span>
                <kbd className="hidden sm:inline rounded bg-red-600/20 px-1 py-0.2 text-[9px] font-mono">⇧K</kbd>
              </button>
            </div>
          </div>

          {/* Unified Threat Posture & Readiness HUD (P2 & P3) */}
          <section aria-label="Security Posture and Executive Defense HUD">
            <CommandCenterSecurityPosture
              round={activeRound}
              kpiData={kpiData}
              liveLatencyMs={isLiveMode ? liveOps?.metrics?.detectionLatencyMs : undefined}
              overallRiskOverride={overallRiskOverride}
              onOpenAsiTaxonomy={() => setAsiModalOpen(true)}
            />
          </section>
        </div>
      </header>

      {/* Main Two-Column Tactical Cockpit Layout */}
      <div className="w-full max-w-[1520px] px-4 sm:px-6 py-6 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left / Primary Threat Theater (~60% width -> lg:col-span-7) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Capability 3: Tactical Agent Interaction Map with Security Zones (P5) */}
            <section aria-label="Agent Interaction Visualization">
              <CommandCenterInteractionMap
                round={activeRound}
                onSelectAgent={inspectAgent}
                onSelectEdge={(from, to) => {
                  const sec = getSecurityEventForRound(activeRound, roundIdx);
                  setInspectorSelection({
                    kind: "threat",
                    title: `Agent Transmission: ${from} → ${to}`,
                    sourceAgent: from,
                    targetAgent: to,
                    evidence: activeRound.prompt,
                    detectionSignal: sec.detectionSignal,
                    action: sec.verdict,
                    confidence: sec.confidence,
                    round: activeRound.round,
                    timestamp: sec.timestamp,
                    eventId: sec.eventId,
                    traceId: sec.traceId,
                  });
                  setInspectorOpen(true);
                }}
              />
            </section>

            {/* Live Prompt Analysis Card with in-situ containment trigger (P4) */}
            <section aria-label="Live Prompt Analysis">
              <CommandCenterPromptAnalysis
                round={activeRound}
                onSelectThreat={inspectThreat}
                onSelectHighlight={inspectHighlight}
                onSelectBadge={inspectStatusBadge}
                onQuarantineTarget={(target) => handleRequestOperatorAction("QUARANTINE_AGENT", target)}
              />
            </section>

            {/* Capability 4: Attack and Containment Timeline with Synchronization (P7) */}
            <section aria-label="Attack and Event Timeline">
              <CommandCenterAttackTimeline
                currentRoundIdx={roundIdx}
                timeline={isLiveMode && liveOps && liveOps.timeline.length > 0 ? liveOps.timeline : undefined}
                onSelectStep={(step, idx) => {
                  setRoundIdx(idx);
                  inspectTimelineStep(step);
                }}
              />
            </section>
          </div>

          {/* Right / Secondary Intelligence & Telemetry Rail (~40% width -> lg:col-span-5) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Permanent Detection Rate Chart with Synchronized ReferenceLine (P7) */}
            <section aria-label="Detection Rate Over Time">
              <CommandCenterDetectionChart
                series={chartSeries}
                activeRound={activeRound.round}
                onSelectRound={(idx) => setRoundIdx(Math.max(0, Math.min(LIVE_ROUNDS.length - 1, idx)))}
              />
            </section>

            {/* Operational Deck (Agent Monitors & Mission Log) */}
            <section aria-label="Agent Monitors and Mission Log">
              <CommandCenterOpsSplit
                round={activeRound}
                logLines={logLines}
                onSelectAgent={inspectAgent}
                onSelectLogLine={inspectLogLine}
              />
            </section>

            {/* Capability: Evaluation & Runtime Arbitration Stream (Balances Right Telemetry Rail) */}
            <section aria-label="Evaluation and Runtime Verdicts">
              <CommandCenterVerdictsDeck
                round={activeRound}
                roundIdx={roundIdx}
                onSelectVerdict={(verdict) => {
                  const sec = getSecurityEventForRound(activeRound, roundIdx);
                  setInspectorSelection({
                    kind: "agent",
                    title: `${verdict.agent} Arbitration Verdict · ${verdict.tone.toUpperCase()}`,
                    threatCode: sec.threatCode,
                    severity: verdict.tone === "warn" ? "critical" : verdict.tone === "ok" ? "info" : "warning",
                    sourceAgent: activeRound.from,
                    targetAgent: verdict.agent,
                    evidence: activeRound.prompt,
                    detectionSignal: sec.detectionSignal,
                    action: verdict.detail,
                    confidence: sec.confidence,
                    round: activeRound.round,
                    timestamp: sec.timestamp,
                    eventId: sec.eventId,
                    traceId: sec.traceId,
                    fields: [
                      { label: "Arbitration Agent", value: verdict.agent },
                      { label: "Verdict State", value: verdict.tone },
                      { label: "Policy Action", value: verdict.detail },
                    ],
                  });
                  setInspectorOpen(true);
                }}
              />
            </section>

            {/* Secondary Operator Interventions Deck */}
            <section aria-label="Operator Interventions">
              <CommandCenterOperatorToolbar
                onRequestAction={handleRequestOperatorAction}
                onReplayCurrentRound={() => {
                  setRoundIdx(0);
                  setLastOperatorAction("Simulation reset to round 1 for replay.");
                }}
                lastOperatorAction={lastOperatorAction}
              />
            </section>
          </div>
        </div>

        {/* Bottom subtle playback toolbar */}
        <footer className="mt-8 flex items-center justify-between border-t border-border pt-4 text-[11px] font-mono text-muted-foreground">
          <div className="flex items-center gap-2">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                liveOps?.telemetryMode === "LIVE"
                  ? "bg-emerald-400 animate-pulse"
                  : liveOps?.telemetryMode === "STALE"
                  ? "bg-amber-400"
                  : liveOps?.telemetryMode === "DISCONNECTED"
                  ? "bg-rose-400"
                  : apiOnline && wsConnected
                  ? "bg-emerald-400"
                  : "bg-sky-400"
              }`}
            />
            <span>
              {liveOps
                ? `TELEMETRY: ${liveOps.telemetryMode}`
                : apiOnline && wsConnected
                ? "TELEMETRY CONNECTED"
                : "LIVE SIMULATION RUNNING"}
            </span>
            <span className="text-slate-600">·</span>
            <span>
              ROUND {activeRound.round} ({isLiveMode ? `${liveOps?.events.length || 0} events` : `${roundIdx + 1}/${LIVE_ROUNDS.length}`})
            </span>
            {liveOps?.error ? (
              <>
                <span className="text-slate-600">·</span>
                <span className="text-rose-500 font-medium">{liveOps.error}</span>
              </>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            {onRefreshLiveOps && (
              <button
                type="button"
                onClick={onRefreshLiveOps}
                className="hover:text-foreground transition-colors cursor-pointer"
                title="Refresh live operational telemetry"
              >
                ⟳ REFRESH
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsPaused((p) => !p)}
              className="hover:text-foreground transition-colors cursor-pointer"
              title={isPaused ? "Resume simulation" : "Pause simulation"}
            >
              {isPaused ? "▶ RESUME" : "⏸ PAUSE"}
            </button>
            <button
              type="button"
              onClick={() => setRoundIdx((prev) => nextRoundIndex(prev, LIVE_ROUNDS.length))}
              className="hover:text-foreground transition-colors cursor-pointer"
              title="Advance to next round immediately"
            >
              NEXT ROUND →
            </button>
          </div>
        </footer>
      </div>

      {/* Capability 5: Threat Inspector Drawer (Section 14) */}
      <CommandCenterInspectorDrawer
        isOpen={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
        selection={inspectorSelection}
        onQuarantineAgent={(agent) => {
          setInspectorOpen(false);
          handleRequestOperatorAction("QUARANTINE_AGENT", agent);
        }}
        onBlockTool={(tool) => {
          setInspectorOpen(false);
          handleRequestOperatorAction("BLOCK_TOOL", tool);
        }}
        onReplayRound={(r) => {
          setInspectorOpen(false);
          setRoundIdx(Math.max(0, Math.min(LIVE_ROUNDS.length - 1, r - 1)));
          setLastOperatorAction(`Replaying Round ${r} in isolation.`);
        }}
      />

      {/* Capability 10: Confirmation Modal for Destructive Interventions (Section 18) */}
      <CommandCenterConfirmationModal
        isOpen={confirmModalOpen}
        actionType={confirmActionType}
        targetName={confirmTargetName}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={handleConfirmAction}
      />

      {/* Capability 6: OWASP ASI01–ASI10 Taxonomy Classification Modal (Section 8) */}
      <CommandCenterAsiModal
        isOpen={asiModalOpen}
        onClose={() => setAsiModalOpen(false)}
        onSelectAsi={inspectAsiCode}
      />
    </div>
  );
}
