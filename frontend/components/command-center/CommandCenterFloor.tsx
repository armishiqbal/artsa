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
import { CommandCenterConfirmationModal, type OperatorActionType } from "./controls/CommandCenterConfirmationModal";
import { CommandCenterOperatorToolbar } from "./controls/CommandCenterOperatorToolbar";
import { cn } from "@/lib/utils";
import { AlertOctagon, Ban, ChevronLeft, ChevronRight, Pause, Play, ShieldCheck } from "lucide-react";
import { CommandCenterAsiModal } from "./taxonomy/CommandCenterAsiModal";
import { CommandCenterVerdictsDeck } from "./verdicts/CommandCenterVerdictsDeck";
import type {
  CampaignRoundReplayResult,
  LiveOpsState,
  OperatorActionResult,
} from "@/lib/hooks/useCommandCenterLiveOps";

export interface CommandCenterFloorProps {
  events: Array<Record<string, unknown>>;
  campaigns: CampaignListItem[];
  apiOnline: boolean;
  wsConnected: boolean;
  liveOps?: LiveOpsState;
  disableAutoTicker?: boolean;
  hideTitle?: boolean;
  onKillSession?: (sessionId: string) => Promise<OperatorActionResult>;
  onQuarantineAgent?: (sessionId: string) => Promise<OperatorActionResult>;
  onBlockTool?: (sessionId: string, toolName: string) => Promise<OperatorActionResult>;
  onDeployMitigation?: (
    sessionId: string,
    options?: {
      ruleName?: string;
      content?: string;
      triggerPhrases?: string[];
      pattern?: string;
      eventType?: string;
      severity?: string;
      riskScore?: number;
      hotPatchSemantic?: boolean;
    }
  ) => Promise<OperatorActionResult>;
  onReplayCampaignRound?: (campaignId: string, roundNumber: number) => Promise<CampaignRoundReplayResult>;
  onRefreshLiveOps?: () => void;
}

export function CommandCenterFloor({
  events,
  apiOnline,
  wsConnected,
  liveOps,
  disableAutoTicker = false,
  hideTitle = false,
  onKillSession,
  onQuarantineAgent,
  onBlockTool,
  onDeployMitigation,
  onReplayCampaignRound,
  onRefreshLiveOps,
}: CommandCenterFloorProps) {
  void events;
  const [roundIdx, setRoundIdx] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const isLiveMode = Boolean(
    liveOps &&
    liveOps.telemetryMode === "LIVE" &&
    (liveOps.events.length > 0 || (liveOps.currentCampaign && liveOps.currentCampaign.status === "RUNNING"))
  );
  const selectedSessionId = liveOps?.currentSession ?? liveOps?.events.find((event) => event.sessionId)?.sessionId ?? null;
  const selectedCampaignId = liveOps?.currentCampaign?.id ?? liveOps?.events.find((event) => event.campaignId)?.campaignId ?? null;
  const eventRoundText = liveOps?.events.find((event) => event.roundId)?.roundId;
  const parsedEventRound = eventRoundText ? Number(eventRoundText.match(/\d+/)?.[0]) : null;
  const selectedRoundNumber = liveOps?.currentRound && liveOps.currentRound > 0
    ? liveOps.currentRound
    : parsedEventRound != null && Number.isInteger(parsedEventRound) && parsedEventRound > 0
      ? parsedEventRound
      : null;
  const selectedToolName = liveOps?.events.find((event) => event.toolName)?.toolName ?? null;

  // Inspector & Modal dialog states
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorSelection, setInspectorSelection] = useState<InspectorSelection | null>(null);

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmActionType, setConfirmActionType] = useState<OperatorActionType>(null);
  const [confirmTargetName, setConfirmTargetName] = useState<string>("Target Agent");
  const [pendingMitigationContent, setPendingMitigationContent] = useState<string | null>(null);

  const [asiModalOpen, setAsiModalOpen] = useState(false);
  const [lastOperatorAction, setLastOperatorAction] = useState<string | null>(null);

  // Automatic round progression for simulation mode ("the whole page moves together each round")
  useEffect(() => {
    if (isPaused || isLiveMode || disableAutoTicker) return;
    const id = window.setInterval(() => {
      setRoundIdx((prev) => nextRoundIndex(prev, LIVE_ROUNDS.length));
    }, LIVE_ROUND_MS);
    return () => window.clearInterval(id);
  }, [isPaused, isLiveMode, disableAutoTicker]);

  // Operator Action Handlers
  const handleRequestOperatorAction = useCallback(
    (actionType: OperatorActionType, targetName?: string, options?: { content?: string }) => {
      setConfirmActionType(actionType);
      setPendingMitigationContent(actionType === "DEPLOY_MITIGATION" ? options?.content ?? null : null);
      setConfirmTargetName(
        actionType === "BLOCK_TOOL"
          ? targetName || "No recorded tool"
          : selectedSessionId || "No active session"
      );
      setConfirmModalOpen(true);
    },
    [selectedSessionId]
  );

  const handleConfirmAction = useCallback(
    async (actionType: string, targetName: string) => {
      const targetSessionId = selectedSessionId;

      if (actionType === "KILL_SESSION") {
        if (isLiveMode && targetSessionId && onKillSession) {
          try {
            const result = await onKillSession(targetSessionId);
            if (result.success) {
              setLastOperatorAction(
                `Backend confirmed KILL for session ${targetSessionId} (status: ${result.data?.status || "unavailable"}).`
              );
              onRefreshLiveOps?.();
            } else {
              setLastOperatorAction(`KILL action failed on session ${targetSessionId}: ${result.error || "Server rejected request"}`);
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setLastOperatorAction(`KILL action error: ${msg}`);
          }
        } else {
          setLastOperatorAction("KILL_SESSION was not sent because no backend session action is available.");
        }
      } else if (actionType === "QUARANTINE_AGENT") {
        if (isLiveMode && targetSessionId && onQuarantineAgent) {
          try {
            const result = await onQuarantineAgent(targetSessionId);
            if (result.success) {
              setLastOperatorAction(
                `Backend confirmed QUARANTINE for session ${targetSessionId} (status: ${result.data?.status || "unavailable"}).`
              );
              onRefreshLiveOps?.();
            } else {
              setLastOperatorAction(`QUARANTINE action failed on ${targetName}: ${result.error || "Server rejected request"}`);
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setLastOperatorAction(`QUARANTINE action error: ${msg}`);
          }
        } else {
          setLastOperatorAction("QUARANTINE was not sent because no backend session action is available.");
        }
      } else if (actionType === "BLOCK_TOOL") {
        if (isLiveMode && targetSessionId && onBlockTool) {
          try {
            const result = await onBlockTool(targetSessionId, targetName);
            if (result.success) {
              setLastOperatorAction(`Backend confirmed the tool action for session ${targetSessionId} (status: ${result.data?.status || "unavailable"}).`);
              onRefreshLiveOps?.();
            } else {
              setLastOperatorAction(`BLOCK_TOOL failed on "${targetName}": ${result.error || "Server rejected request"}`);
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setLastOperatorAction(`BLOCK_TOOL error: ${msg}`);
          }
        } else {
          setLastOperatorAction("BLOCK_TOOL was not sent because no backend tool action is available.");
        }
      } else if (actionType === "DEPLOY_MITIGATION") {
        if (isLiveMode && targetSessionId && onDeployMitigation) {
          try {
            const result = await onDeployMitigation(targetSessionId, {
              ruleName: `Mitigate session ${targetSessionId}`,
              ...(pendingMitigationContent ? { content: pendingMitigationContent } : {}),
            });
            if (result.success) {
              const ruleName = result.data?.rule_name || result.data?.ruleName;
              const version = result.data?.playbook_version ?? result.data?.playbookVersion;
              const recordedRule = ruleName ? ` ${ruleName}` : "";
              const recordedVersion = version != null ? ` v${version}` : "";
              setLastOperatorAction(`Backend confirmed mitigation${recordedRule}${recordedVersion} for session ${targetSessionId}.`);
              onRefreshLiveOps?.();
            } else {
              setLastOperatorAction(`DEPLOY_MITIGATION failed: ${result.error || "Server rejected request"}`);
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setLastOperatorAction(`DEPLOY_MITIGATION error: ${msg}`);
          }
        } else {
          setLastOperatorAction("DEPLOY_MITIGATION was not sent because no backend policy action is available.");
        }
      }
    },
    [isLiveMode, selectedSessionId, pendingMitigationContent, onKillSession, onQuarantineAgent, onBlockTool, onDeployMitigation, onRefreshLiveOps]
  );

  const handleReplayCampaignRound = useCallback(async (requestedRound?: number) => {
    if (!isLiveMode || !selectedCampaignId || !onReplayCampaignRound) {
      setLastOperatorAction("Replay was not sent because no live campaign replay endpoint is available.");
      return;
    }
    const roundNumber = requestedRound ?? selectedRoundNumber;
    if (!roundNumber || !Number.isInteger(roundNumber) || roundNumber < 1) {
      setLastOperatorAction("Replay was not sent because no saved round number is available.");
      return;
    }
    const result = await onReplayCampaignRound(selectedCampaignId, roundNumber);
    if (!result.success) {
      setLastOperatorAction(`Round ${roundNumber} replay failed: ${result.error || "Backend did not confirm the replay."}`);
      return;
    }
    const verdict = result.data?.replayedVerdict ? ` · verdict ${result.data.replayedVerdict}` : "";
    const mitigated = result.data?.mitigated == null ? "" : result.data.mitigated ? " · mitigation confirmed" : " · still breached";
    setLastOperatorAction(`Backend confirmed replay of ${selectedCampaignId} round ${roundNumber}${verdict}${mitigated}.`);
    onRefreshLiveOps?.();
  }, [isLiveMode, selectedCampaignId, selectedRoundNumber, onReplayCampaignRound, onRefreshLiveOps]);

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
          setPendingMitigationContent(null);
          e.preventDefault();
        } else if (asiModalOpen) {
          setAsiModalOpen(false);
          e.preventDefault();
        } else if (inspectorOpen) {
          setInspectorOpen(false);
          e.preventDefault();
        }
      } else if (!isLiveMode && (e.key === " " || e.code === "Space")) {
        e.preventDefault();
        setIsPaused((prev) => !prev);
      } else if (!isLiveMode && e.key === "ArrowRight") {
        e.preventDefault();
        setRoundIdx((prev) => nextRoundIndex(prev, LIVE_ROUNDS.length));
      } else if (isLiveMode && selectedSessionId && (e.key === "K" || e.key === "k") && e.shiftKey) {
        e.preventDefault();
        handleRequestOperatorAction("KILL_SESSION");
      } else if (isLiveMode && selectedSessionId && (e.key === "Q" || e.key === "q") && e.shiftKey) {
        e.preventDefault();
        handleRequestOperatorAction("QUARANTINE_AGENT", "Target Agent");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [confirmModalOpen, asiModalOpen, inspectorOpen, isLiveMode, selectedSessionId, handleRequestOperatorAction]);

  const simulationRound = LIVE_ROUNDS[roundIdx] ?? LIVE_ROUNDS[0]!;

  const activeRound: LiveRound = useMemo(() => {
    if (!isLiveMode || !liveOps) {
      return simulationRound;
    }

    const latestEvent = liveOps.events[0];
    const parsedRound = latestEvent?.roundId ? parseInt(latestEvent.roundId.replace(/\D/g, ""), 10) : null;
    const liveRoundNumber = liveOps.currentRound ?? (parsedRound != null && Number.isFinite(parsedRound) ? parsedRound : 0);

    const agentMap: Record<SixAgentName, AgentLiveState> = {
      Research: "unknown",
      Curator: "unknown",
      "Red Team": "unknown",
      Target: "unknown",
      Judge: "unknown",
      Defender: "unknown",
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
      if (ev.threatCode && ev.confidence != null) {
        bars.push({
          code: ev.threatCode,
          label: ev.eventType,
          pct: Math.round(ev.confidence * 100),
          tone: ev.severity === "CRITICAL" || ev.severity === "HIGH" ? "alert" : "warn",
        });
      }
    }

    // Convert live events to verdicts
    const verdicts: VerdictItem[] = [];
    for (const ev of liveOps.events.slice(0, 3)) {
      const targetLower = ev.targetAgent.toLowerCase();
      const agentRole: VerdictItem["agent"] | null =
        targetLower.includes("judge") ? "Judge" :
        targetLower.includes("defend") ? "Defender" :
        targetLower.includes("target") ? "Target" : null;
      if (!agentRole || (!ev.verdict && !ev.mitigation)) continue;
      const verdict = ev.verdict.trim().toUpperCase();
      const tone: VerdictTone =
        ["ALLOW", "SAFE", "PASS"].includes(verdict) ? "ok" :
        ev.severity === "CRITICAL" || ev.severity === "HIGH" ? "warn" : "pending";
      verdicts.push({
        agent: agentRole,
        detail: ev.verdict || ev.mitigation,
        tone,
      });
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
      from: latestEvent?.sourceAgent || "—",
      to: latestEvent?.targetAgent || "—",
      prompt: latestEvent?.payload || "No prompt payload was recorded for this event.",
      highlights,
      bars,
      agents: agentMap,
      latencies,
      verdicts,
      log: latestEvent ? `[${latestEvent.sourceAgent || "—"} -> ${latestEvent.targetAgent || "—"}] ${latestEvent.threatCode || latestEvent.eventType || "event"}: ${latestEvent.verdict || latestEvent.mitigation || "No verdict recorded"}` : "No event record is available.",
      statusBadge: liveOps.telemetryMode === "LIVE" ? "LIVE TELEMETRY" : liveOps.telemetryMode === "STALE" ? "STALE TELEMETRY" : "DISCONNECTED",
      badgeTone: liveOps.telemetryMode === "LIVE" ? "live" : liveOps.telemetryMode === "STALE" ? "warning" : "error",
      event: latestEvent
        ? {
            eventId: latestEvent.eventId,
            campaignId: latestEvent.campaignId || liveOps.currentCampaign?.id || "—",
            sessionId: latestEvent.sessionId || liveOps.currentSession || "—",
            roundId: latestEvent.roundId || (liveRoundNumber > 0 ? `R${liveRoundNumber}` : "—"),
            timestamp: latestEvent.timestamp,
            sourceAgent: latestEvent.sourceAgent,
            targetAgent: latestEvent.targetAgent,
            threatCode: latestEvent.threatCode || "—",
            severity:
              latestEvent.severity === "CRITICAL"
                ? "critical"
                : latestEvent.severity === "HIGH" || latestEvent.severity === "MEDIUM"
                ? "warning"
                : latestEvent.severity === "LOW" || latestEvent.severity === "INFO"
                ? "info"
                : "unclassified",
            payload: latestEvent.payload,
            detectionSignal: latestEvent.detectionSignal,
            verdict: latestEvent.verdict,
            mitigation: latestEvent.mitigation,
            traceId: latestEvent.traceId,
            ...(latestEvent.confidence != null
              ? { confidence: Math.round(latestEvent.confidence * 100) }
              : {}),
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
    return liveOps?.circuitBreaker?.status === "tripped";
  }, [liveOps?.circuitBreaker?.status]);

  // Walkthrough values are explicitly labeled; live mode only shows API-backed metrics.
  const kpiData = useMemo(() => {
    if (!isLiveMode || !liveOps) {
      if (activeRound.kpis) return activeRound.kpis;
      return {
        trustChain: DEFAULT_KPIS.trustChain,
        detectionRate: DEFAULT_KPIS.detectionRate,
        disagreementRate: DEFAULT_KPIS.disagreementRate,
        recordedAlerts: DEFAULT_KPIS.recordedAlerts,
      };
    }

    const m = liveOps.metrics;
    const flaggedEvents = liveOps.events.filter(
      (event) => event.severity === "CRITICAL" || event.severity === "HIGH"
    ).length;

    return {
      trustChain: null,
      detectionRate: m?.detectionRate != null ? Math.round(m.detectionRate * 100) : null,
      disagreementRate: null,
      recordedAlerts: flaggedEvents,
    };
  }, [isLiveMode, liveOps, activeRound]);

  const overallRiskOverride: "CRITICAL" | "ELEVATED" | undefined = useMemo(() => {
    if (!isLiveMode || !liveOps) return undefined;
    if (liveOps.events.some((e) => e.severity === "CRITICAL")) return "CRITICAL";
    if (liveOps.events.some((e) => e.severity === "HIGH")) return "ELEVATED";
    return undefined;
  }, [isLiveMode, liveOps]);

  // The API exposes current metrics, not historical points; never splice one live point into a sample chart.
  const chartSeries: DetectionHistoryPoint[] = useMemo(() => {
    return isLiveMode ? [] : DEFAULT_DETECTION_SERIES;
  }, [isLiveMode]);

  // Live Defender Status & Patch Notifications
  const defenderAgentState = activeRound.agents?.Defender ?? "unknown";
  const defenderIntervening = defenderAgentState === "active" || defenderAgentState === "responding";
  const defenderStatusLabel = !isLiveMode
    ? "WALKTHROUGH · NO DEFENDER ACTION"
    : defenderIntervening
      ? "DEFENDER · RESPONDING"
      : defenderAgentState === "unknown" || defenderAgentState === "not wired" || defenderAgentState === "not_wired"
        ? "DEFENDER · STATUS UNKNOWN"
        : defenderAgentState === "contained"
          ? "DEFENDER · CONTAINED"
          : "DEFENDER · IDLE";

  const defenderPatchedCount = useMemo(() => {
    if (!isLiveMode || !liveOps?.events) return 0;
    return liveOps.events.filter((event) => event.mitigation.toLowerCase().includes("patch")).length;
  }, [isLiveMode, liveOps?.events]);

  // Inspector opener helpers
  const inspectAgent = useCallback((agent: SixAgentName) => {
    const sec = getSecurityEventForRound(activeRound, roundIdx);
    const state = activeRound.agents[agent] ?? "unknown";
    const isUnderAttack = state === "active" || state === "responding";
    const stateUnavailable = state === "unknown" || state === "not wired" || state === "not_wired";

    setInspectorSelection({
      kind: "agent",
      title: `${agent === "Red Team" ? "Red Team" : agent} Telemetry`,
      threatCode: sec.threatCode,
      severity: stateUnavailable ? "unclassified" : isUnderAttack ? "warning" : state === "contained" ? "warning" : "info",
      sourceAgent: agent,
      targetAgent: activeRound.to,
      evidence: activeRound.prompt,
      detectionSignal: sec.detectionSignal,
      action: stateUnavailable ? "UNAVAILABLE" : state.toUpperCase(),
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
    const isAlert = bar.tone === "alert";

    setInspectorSelection({
      kind: "threat",
      title: `${bar.code} · ${bar.label.toUpperCase()}`,
      threatCode: bar.code,
      severity: isAlert ? "warning" : "info",
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
        { label: "Confidence", value: `${bar.pct}%` },
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
      threatCode: isInject ? "Lexical injection cue" : "Tool mention",
      severity: "unclassified",
      sourceAgent: activeRound.from,
      targetAgent: activeRound.to,
      evidence: activeRound.prompt,
      detectionSignal: "Lexical highlight only; no backend detector result is recorded for this token.",
      action: sec.verdict,
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
      threatCode: activeRound.bars[0]?.code ?? "—",
      severity: activeRound.badgeTone === "error" ? "critical" : activeRound.statusBadge?.includes("TELEMETRY") ? "info" : "unclassified",
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
      severity: /fail|breach/i.test(line) ? "warning" : "info",
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
      round: step.round ?? undefined,
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
      className="cc-floor min-h-screen w-full bg-slate-50/40 text-slate-900 flex flex-col select-none transition-colors"
    >
      <header className={cn("w-full", !hideTitle ? "border-b border-slate-200/80 bg-white" : "border-b border-slate-200/60 bg-white/60")}>
        <div className={cn("w-full max-w-[1680px] mx-auto px-4 sm:px-6", !hideTitle ? "py-5 sm:py-7 space-y-5" : "py-3 space-y-3")}>
          {!hideTitle && (
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-400">
                  ARTSA · Strategic operations
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  Command Center
                </h1>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  Six-agent health, trust signals, detection trends, and campaign activity.
                </p>
              </div>
              {circuitBreakerOpen ? (
                <p data-testid="circuit-breaker-alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-700 dark:text-rose-300">
                  Session circuit breaker telemetry reports a trip.
                </p>
              ) : null}
            </div>
          )}
          {hideTitle && circuitBreakerOpen ? (
            <p data-testid="circuit-breaker-alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-700 dark:text-rose-300">
              Session circuit breaker telemetry reports a trip.
            </p>
          ) : null}
          {/* Campaign context stays separate from controls to keep the header readable. */}
          <div>
            <CommandCenterCampaignContext
              campaignName={
                isLiveMode
                  ? (liveOps?.currentCampaign?.name || "NO ACTIVE CAMPAIGN")
                  : "Seeded walkthrough"
              }
              sessionId={
                isLiveMode
                  ? (liveOps?.currentSession || "NO ACTIVE SESSION")
                  : `Example round ${activeRound.round}`
              }
              targetName={isLiveMode ? "Connected agent target" : "Sample agent chain"}
              roundNumber={isLiveMode ? (liveOps?.currentRound ?? activeRound.round) : activeRound.round}
              apiOnline={apiOnline}
              wsConnected={wsConnected}
              isPaused={isPaused}
              telemetryState={liveOps?.telemetryMode ?? "SIMULATION"}
              lastEventAt={isLiveMode ? liveOps?.connection.lastEventAt : null}
              className="rounded-xl border border-border/80 bg-background px-4 py-3 sm:px-5 sm:py-4"
            />
          </div>

          {/* Walkthrough navigation is always visible; live actions appear only for a live session. */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <div
                data-testid="defender-status-pill"
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-[11px] tracking-wider transition-colors ${
                  !isLiveMode
                    ? "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300"
                    : defenderIntervening
                    ? "border-amber-500/60 bg-amber-500/10 text-amber-600 dark:text-amber-400 animate-pulse"
                    : "border-border bg-background text-muted-foreground"
                }`}
                title={isLiveMode ? "Defender state from live telemetry" : "Walkthrough state; no live Defender action is running"}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span className="font-bold uppercase">
                  {defenderStatusLabel}
                </span>
                {isLiveMode && defenderPatchedCount > 0 && (
                  <span className="rounded-full bg-emerald-500/20 dark:bg-emerald-500/30 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                    {defenderPatchedCount} patch events
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!isLiveMode ? (
                <div className="inline-flex min-h-9 flex-wrap items-center gap-1 rounded-lg border border-slate-200/90 bg-white p-1 shadow-2xs">
                  {/* Visual Round Jumper Buttons */}
                  <div className="hidden md:flex items-center gap-0.5 pr-1 border-r border-slate-200/70">
                    {LIVE_ROUNDS.map((r, i) => (
                      <button
                        key={r.round}
                        type="button"
                        onClick={() => setRoundIdx(i)}
                        className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all",
                          roundIdx === i
                            ? "bg-blue-600 text-white shadow-2xs"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                        )}
                        title={`Jump to Round ${r.round}: ${r.from} -> ${r.to}`}
                      >
                        R{r.round}
                      </button>
                    ))}
                  </div>

                  <span className="px-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Walkthrough · {isPaused ? "Paused" : "Playing"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setRoundIdx((prev) => (prev - 1 + LIVE_ROUNDS.length) % LIVE_ROUNDS.length)}
                    aria-label="Previous walkthrough round"
                    title="Previous example"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden />
                  </button>
                  <span className="min-w-[3.5rem] text-center font-mono text-[11px] font-semibold tabular-nums text-slate-900">
                    {roundIdx + 1} / {LIVE_ROUNDS.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setRoundIdx((prev) => nextRoundIndex(prev, LIVE_ROUNDS.length))}
                    aria-label="Next walkthrough round"
                    title="Next example"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </button>
                  <span className="mx-0.5 h-4 w-px bg-slate-200" aria-hidden />
                  <button
                    type="button"
                    onClick={() => setIsPaused((paused) => !paused)}
                    aria-label={isPaused ? "Play walkthrough" : "Freeze walkthrough"}
                    title={isPaused ? "Play walkthrough" : "Freeze walkthrough"}
                    className="inline-flex h-7 items-center gap-1 rounded-md bg-slate-100 px-2 font-mono text-[11px] font-medium text-slate-800 transition-colors hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                  >
                    {isPaused ? <Play className="h-3 w-3 text-slate-900" aria-hidden /> : <Pause className="h-3 w-3" aria-hidden />}
                    {isPaused ? "Play" : "Hold"}
                  </button>
                </div>
              ) : liveOps?.currentSession ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleRequestOperatorAction("QUARANTINE_AGENT", "Target Agent")}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-rose-500/50 bg-rose-500/10 px-3 font-mono text-[11px] font-bold uppercase tracking-wider text-rose-700 transition-colors hover:bg-rose-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:text-rose-300"
                    title="Quarantine Target Agent (Shift + Q)"
                  >
                    <Ban className="h-3.5 w-3.5" aria-hidden />
                    QUARANTINE
                    <kbd className="hidden rounded bg-rose-500/20 px-1 text-[9px] font-mono sm:inline">⇧Q</kbd>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRequestOperatorAction("KILL_SESSION")}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-red-600/70 bg-red-600/10 px-3 font-mono text-[11px] font-bold uppercase tracking-wider text-red-700 transition-colors hover:bg-red-600/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-red-300"
                    title="Emergency Kill Session (Shift + K)"
                  >
                    <AlertOctagon className="h-3.5 w-3.5" aria-hidden />
                    KILL SESSION
                    <kbd className="hidden rounded bg-red-600/20 px-1 text-[9px] font-mono sm:inline">⇧K</kbd>
                  </button>
                </>
              ) : (
                <span className="inline-flex min-h-9 items-center rounded-lg border border-border bg-background px-3 text-xs text-muted-foreground">
                  Operator actions unlock when a live session is selected.
                </span>
              )}
            </div>
          </div>

        </div>
      </header>

      <section className="w-full max-w-[1680px] mx-auto px-4 sm:px-6 pt-4" aria-label="Security posture">
        <CommandCenterSecurityPosture
          round={activeRound}
          kpiData={kpiData}
          dataMode={isLiveMode ? "LIVE" : "WALKTHROUGH"}
          liveLatencyMs={isLiveMode ? liveOps?.metrics?.detectionLatencyMs : undefined}
          overallRiskOverride={overallRiskOverride}
          onOpenAsiTaxonomy={() => setAsiModalOpen(true)}
        />
      </section>

      {/* Strategic operations floor: chain health and detection trends lead the page. */}
      <div className="w-full max-w-[1680px] mx-auto px-4 sm:px-6 py-4 sm:py-5 flex-1">
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
            <section aria-label={isLiveMode ? "Live prompt evidence" : "Walkthrough prompt sample"}>
              <CommandCenterPromptAnalysis
                round={activeRound}
                liveMode={isLiveMode}
                sessionId={selectedSessionId}
                onSelectThreat={inspectThreat}
                onSelectHighlight={inspectHighlight}
                onSelectBadge={inspectStatusBadge}
                onQuarantineTarget={(target) => handleRequestOperatorAction("QUARANTINE_AGENT", target)}
                onDeployMitigation={(prompt) => handleRequestOperatorAction("DEPLOY_MITIGATION", selectedSessionId ?? undefined, { content: prompt })}
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
                dataMode={isLiveMode ? "NO_LIVE_HISTORY" : "WALKTHROUGH"}
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

            {/* Operator Interventions Deck */}
            <section aria-label="Operator Interventions">
              <CommandCenterOperatorToolbar
                onRequestAction={handleRequestOperatorAction}
                onReplayCurrentRound={() => void handleReplayCampaignRound()}
                liveMode={isLiveMode}
                sessionId={selectedSessionId}
                toolName={selectedToolName}
                campaignId={selectedCampaignId}
                roundNumber={selectedRoundNumber}
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
                  : "bg-sky-400"
              }`}
            />
            <span>
              TELEMETRY: {liveOps?.telemetryMode ?? "SIMULATION"}
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
            {!isLiveMode && (
              <>
                <button
                  type="button"
                  onClick={() => setIsPaused((p) => !p)}
                  className="hover:text-foreground transition-colors cursor-pointer"
                  title={isPaused ? "Resume walkthrough" : "Pause walkthrough"}
                >
                  {isPaused ? "▶ RESUME" : "⏸ PAUSE"}
                </button>
                <button
                  type="button"
                  onClick={() => setRoundIdx((prev) => nextRoundIndex(prev, LIVE_ROUNDS.length))}
                  className="hover:text-foreground transition-colors cursor-pointer"
                  title="Advance walkthrough to next sample round"
                >
                  NEXT SAMPLE →
                </button>
              </>
            )}
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
          if (isLiveMode) {
            void handleReplayCampaignRound(r);
          } else {
            setRoundIdx(Math.max(0, Math.min(LIVE_ROUNDS.length - 1, r - 1)));
            setLastOperatorAction(`Selected walkthrough sample round ${r}; no backend replay was run.`);
          }
        }}
      />

      {/* Capability 10: Confirmation Modal for Destructive Interventions (Section 18) */}
      <CommandCenterConfirmationModal
        isOpen={confirmModalOpen}
        actionType={confirmActionType}
        targetName={confirmTargetName}
        liveMode={isLiveMode}
        requestAvailable={Boolean(
          isLiveMode &&
          selectedSessionId &&
          (confirmActionType !== "BLOCK_TOOL" || confirmTargetName !== "No recorded tool")
        )}
        onClose={() => {
          setConfirmModalOpen(false);
          setPendingMitigationContent(null);
        }}
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
