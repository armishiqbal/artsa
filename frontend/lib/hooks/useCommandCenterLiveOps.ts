"use client";

/**
 * Command Center Live Operational Telemetry Adapter (ARTSA Phase 2.2).
 *
 * Bridges the backend canonical telemetry (GET /api/v1/telemetry/ops, WebSocket
 * /websocket, POST /api/v1/sessions/{session_id}/action) to the Command Center.
 *
 * Guarantees:
 * 1. Honest Freshness: Reports LIVE only when recent real events exist.
 *    Transitions to STALE after 30s or DISCONNECTED upon socket drop.
 * 2. Simulation Fallback: Preserves LIVE_ROUNDS fallback when backend is offline,
 *    clearly tagging state as telemetryMode: "SIMULATION".
 * 3. Security Boundary: Bounded/redacted strings only; never exposes API keys,
 *    HMAC secrets, or raw credentials.
 * 4. Authoritative Actions: Server-authoritative session containment (KILL, QUARANTINE).
 * 5. Deduplication: Idempotent event consumption via eventId.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { buildHeaders, fetchFromBackend, unwrapEnvelope } from "@/lib/api";
import { buildWebSocketUrl } from "@/lib/ws";
import { useReconnectingWebSocket } from "@/lib/hooks/useReconnectingWebSocket";
import {
  LIVE_ROUNDS,
  type AttackTimelineStep,
  type LiveRound,
} from "@/components/command-center/prototype/liveRounds";

// ---------------------------------------------------------------------------
// TYPES & CONTRACTS
// ---------------------------------------------------------------------------

export type LiveTelemetryMode = "LIVE" | "SIMULATION" | "STALE" | "DISCONNECTED";

export interface LiveOpsCampaign {
  id: string;
  name: string;
  status: string;
  roundsCompleted: number;
  totalRounds?: number;
}

export interface LiveOpsAgentSnapshot {
  agentId: string;
  role: string;
  state: "idle" | "active" | "responding" | "waiting" | "contained" | "not_wired";
  currentTask: string | null;
  lastEventId: string | null;
  latencyMs: number | null;
  risk: number | null;
  currentRound: number | null;
}

export interface LiveOpsHmacRecord {
  sender: string | null;
  receiver: string | null;
  hmacState: string;
  signatureStatus: "unwired" | "verified" | "failed";
  verificationResult: string | null;
  replayDetected: boolean | null;
  nonce: string | null;
  eventId: string | null;
  containmentResult: string | null;
}

export interface LiveOpsSecurityEvent {
  eventId: string;
  campaignId: string | null;
  sessionId: string | null;
  roundId: string | null;
  timestamp: string;
  sourceAgent: string;
  targetAgent: string;
  threatCode: string | null;
  threatStatus: "classified" | "unsupported" | "unwired" | "unclassified";
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  payload: string;
  detectionSignal: string;
  verdict: string;
  mitigation: string;
  confidence: number | null;
  traceId: string;
  toolName: string | null;
  latencyMs: number | null;
  status: string | null;
  eventType: string;
  hmac: LiveOpsHmacRecord;
}

export interface LiveOpsMetrics {
  judged: number;
  truePositive: number;
  falseNegative: number;
  falsePositive: number | null;
  trueNegative: number | null;
  detectionRate: number | null;
  precision: number | null;
  recall: number | null;
  falsePositiveRate: number | null;
  falseNegativeRate: number | null;
  detectionLatencyMs: number | null;
  containmentRate: number | null;
  adaptiveDetection: number | null;
  baselineDetection: number | null;
  adaptiveLift: number | null;
  adaptiveCampaignId: string | null;
  baselineCampaignId: string | null;
}

export interface LiveOpsCircuitBreaker {
  status: "nominal" | "tripped" | "unsupported";
  note: string;
}

export interface LiveOpsConnectionState {
  connected: boolean;
  lastConnectedAt: string | null;
  lastEventAt: string | null;
  reconnectCount: number;
}

export interface LiveOpsOperatorActionSpec {
  actionId: string;
  implemented: boolean;
  method: string | null;
  path: string | null;
  note: string;
}

export interface LiveOpsState {
  telemetryMode: LiveTelemetryMode;
  isLive: boolean;
  tenantId: string | null;
  currentCampaign: LiveOpsCampaign | null;
  currentSession: string | null;
  currentRound: number | null;
  agents: LiveOpsAgentSnapshot[];
  events: LiveOpsSecurityEvent[];
  timeline: AttackTimelineStep[];
  metrics: LiveOpsMetrics | null;
  circuitBreaker: LiveOpsCircuitBreaker;
  connection: LiveOpsConnectionState;
  operatorActions: LiveOpsOperatorActionSpec[];
  error: string | null;
}

export type OperatorActionType = "KILL" | "QUARANTINE";

export interface OperatorActionResult {
  success: boolean;
  action: OperatorActionType;
  sessionId: string;
  statusCode?: number;
  data?: {
    sessionId: string;
    enforcedAction: string;
    status: string;
    idempotent?: boolean;
    traceId?: string;
    eventId?: string;
  };
  error?: string;
}

export interface UseCommandCenterLiveOpsOptions {
  enabled?: boolean;
  pollIntervalMs?: number;
  staleThresholdMs?: number;
  forceSimulation?: boolean;
}

// ---------------------------------------------------------------------------
// CONSTANTS & INITIAL STATE
// ---------------------------------------------------------------------------

const STALE_THRESHOLD_MS_DEFAULT = 30_000;
const MAX_EVENTS_IN_MEMORY = 150;
const API_BASE_URL = "/api/backend";

export const INITIAL_CIRCUIT_BREAKER: LiveOpsCircuitBreaker = {
  status: "unsupported",
  note: "ASI08 cascading failure detector is not implemented in live engine",
};

export const INITIAL_CONNECTION_STATE: LiveOpsConnectionState = {
  connected: false,
  lastConnectedAt: null,
  lastEventAt: null,
  reconnectCount: 0,
};

export const DEFAULT_OPERATOR_ACTIONS: LiveOpsOperatorActionSpec[] = [
  {
    actionId: "KILL_SESSION",
    implemented: true,
    method: "POST",
    path: "/api/v1/sessions/{session_id}/action",
    note: "Authoritative termination on the server.",
  },
  {
    actionId: "QUARANTINE_AGENT",
    implemented: true,
    method: "POST",
    path: "/api/v1/sessions/{session_id}/action",
    note: "Authoritative session quarantine on the server.",
  },
  {
    actionId: "BLOCK_TOOL",
    implemented: false,
    method: null,
    path: null,
    note: "TODO: no per-tool block API.",
  },
  {
    actionId: "REPLAY_ROUND",
    implemented: false,
    method: null,
    path: null,
    note: "TODO: rounds are persisted; re-execution is not an API.",
  },
  {
    actionId: "DEPLOY_MITIGATION",
    implemented: false,
    method: null,
    path: null,
    note: "Human-gated policy suggestions exist; auto-deploy not supported.",
  },
];

// ---------------------------------------------------------------------------
// NORMALIZATION HELPERS (Exported for Testing)
// ---------------------------------------------------------------------------

/**
 * Defensive parser for numbers.
 */
function toOptionalNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const num = Number(val);
  return Number.isFinite(num) ? num : null;
}

/**
 * Defensive parser for integers with fallback.
 */
function toSafeInt(val: unknown, fallback = 0): number {
  if (val === null || val === undefined || val === "") return fallback;
  const num = Number(val);
  return Number.isFinite(num) ? Math.trunc(num) : fallback;
}

/**
 * Explicit schema mapper: normalizes snake_case backend HMAC record.
 */
export function normalizeHmacRecord(raw: unknown): LiveOpsHmacRecord {
  if (!raw || typeof raw !== "object") {
    return {
      sender: null,
      receiver: null,
      hmacState: "unwired",
      signatureStatus: "unwired",
      verificationResult: null,
      replayDetected: null,
      nonce: null,
      eventId: null,
      containmentResult: null,
    };
  }
  const r = raw as Record<string, unknown>;
  return {
    sender: r.sender ? String(r.sender) : null,
    receiver: r.receiver ? String(r.receiver) : null,
    hmacState: String(r.hmac_state || r.hmacState || "unwired"),
    signatureStatus:
      r.signature_status === "verified" || r.signatureStatus === "verified"
        ? "verified"
        : r.signature_status === "failed" || r.signatureStatus === "failed"
        ? "failed"
        : "unwired",
    verificationResult: r.verification_result ? String(r.verification_result) : null,
    replayDetected: typeof r.replay_detected === "boolean" ? r.replay_detected : null,
    nonce: r.nonce ? String(r.nonce) : null,
    eventId: r.event_id ? String(r.event_id) : null,
    containmentResult: r.containment_result ? String(r.containment_result) : null,
  };
}

/**
 * Explicit schema mapper: normalizes snake_case SecurityOpsEvent.
 * Treats payload as untrusted: bounds string length and redacts secret patterns.
 */
export function normalizeSecurityEvent(raw: unknown): LiveOpsSecurityEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const eventId = String(r.event_id || r.eventId || r.id || "");
  if (!eventId) return null;

  const rawSeverity = String(r.severity || "INFO").toUpperCase();
  const severity: LiveOpsSecurityEvent["severity"] =
    rawSeverity === "CRITICAL" ||
    rawSeverity === "HIGH" ||
    rawSeverity === "MEDIUM" ||
    rawSeverity === "LOW"
      ? rawSeverity
      : "INFO";

  // Sanitize & bound payload to prevent giant or sensitive dumps
  let rawPayload = String(r.payload || r.tool_name || r.type || "");
  if (rawPayload.length > 2000) {
    rawPayload = rawPayload.slice(0, 2000) + "... [TRUNCATED]";
  }
  // Redact obvious secret patterns if found in raw payload
  const sanitizedPayload = rawPayload
    .replace(/bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]")
    .replace(/api[_-]?key[:=]\s*['"]?[A-Za-z0-9_-]{16,}['"]?/gi, "api_key=[REDACTED]")
    .replace(/(?:secret[_-]?key|access[_-]?token|password)[:=]\s*['"]?[A-Za-z0-9._~+/-]{8,}['"]?/gi, "credential=[REDACTED]");

  return {
    eventId,
    campaignId: r.campaign_id ? String(r.campaign_id) : r.campaignId ? String(r.campaignId) : null,
    sessionId: r.session_id ? String(r.session_id) : r.sessionId ? String(r.sessionId) : null,
    roundId: r.round_id ? String(r.round_id) : r.roundId ? String(r.roundId) : null,
    timestamp: r.timestamp ? String(r.timestamp) : new Date().toISOString(),
    sourceAgent: String(r.source_agent || r.sourceAgent || r.agent_id || "unknown"),
    targetAgent: String(r.target_agent || r.targetAgent || "containment"),
    threatCode: r.threat_code || r.threatCode ? String(r.threat_code || r.threatCode) : null,
    threatStatus: (r.threat_status || r.threatStatus || "unclassified") as LiveOpsSecurityEvent["threatStatus"],
    severity,
    payload: sanitizedPayload,
    detectionSignal: String(r.detection_signal || r.detectionSignal || r.signal || ""),
    verdict: String(r.verdict || ""),
    mitigation: String(r.mitigation || r.action || ""),
    confidence: toOptionalNumber(r.confidence),
    traceId: String(r.trace_id || r.traceId || eventId),
    toolName: r.tool_name ? String(r.tool_name) : null,
    latencyMs: toOptionalNumber(r.latency_ms ?? r.latencyMs),
    status: r.status ? String(r.status) : null,
    eventType: String(r.event_type || r.eventType || r.type || "security"),
    hmac: normalizeHmacRecord(r.hmac),
  };
}

/**
 * Projects a normalized LiveOpsSecurityEvent into an AttackTimelineStep.
 */
export function eventToTimelineStep(evt: LiveOpsSecurityEvent, index: number): AttackTimelineStep {
  const parsedRound = evt.roundId ? parseInt(evt.roundId.replace(/\D/g, ""), 10) : NaN;
  const roundNum = Number.isFinite(parsedRound) && parsedRound > 0 ? parsedRound : index + 1;

  const vLower = evt.verdict.toLowerCase();
  const status: AttackTimelineStep["status"] =
    vLower.includes("quarantin") || vLower.includes("contain")
      ? "contained"
      : vLower.includes("block") || vLower.includes("drop")
      ? "blocked"
      : vLower.includes("breach")
      ? "breach"
      : evt.severity === "CRITICAL" || evt.severity === "HIGH"
      ? "suspicious"
      : "nominal";

  return {
    round: roundNum,
    label: `R${roundNum} · ${evt.threatCode || evt.eventType || "Event"}`,
    whatHappened: evt.payload || "Security ops event recorded",
    when: evt.timestamp ? new Date(evt.timestamp).toLocaleTimeString() : "Just now",
    whatDetectedIt: evt.detectionSignal || "Detector",
    actionTaken: evt.mitigation || evt.verdict || "Logged",
    status,
    agentFrom: evt.sourceAgent,
    agentTo: evt.targetAgent,
    threatCode: evt.threatCode || "INFO",
    eventId: evt.eventId,
    traceId: evt.traceId,
  };
}

/**
 * Normalizes DetectionMetrics from backend.
 */
export function normalizeDetectionMetrics(raw: unknown): LiveOpsMetrics | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return {
    judged: toSafeInt(r.judged, 0),
    truePositive: toSafeInt(r.true_positive ?? r.truePositive, 0),
    falseNegative: toSafeInt(r.false_negative ?? r.falseNegative, 0),
    falsePositive: toOptionalNumber(r.false_positive ?? r.falsePositive),
    trueNegative: toOptionalNumber(r.true_negative ?? r.trueNegative),
    detectionRate: toOptionalNumber(r.detection_rate ?? r.detectionRate),
    precision: toOptionalNumber(r.precision),
    recall: toOptionalNumber(r.recall),
    falsePositiveRate: toOptionalNumber(r.false_positive_rate ?? r.falsePositiveRate),
    falseNegativeRate: toOptionalNumber(r.false_negative_rate ?? r.falseNegativeRate),
    detectionLatencyMs: toOptionalNumber(r.detection_latency_ms ?? r.detectionLatencyMs),
    containmentRate: toOptionalNumber(r.containment_rate ?? r.containmentRate),
    adaptiveDetection: toOptionalNumber(r.adaptive_detection ?? r.adaptiveDetection),
    baselineDetection: toOptionalNumber(r.baseline_detection ?? r.baselineDetection),
    adaptiveLift: toOptionalNumber(r.adaptive_lift ?? r.adaptiveLift),
    adaptiveCampaignId: r.adaptive_campaign_id ? String(r.adaptive_campaign_id) : null,
    baselineCampaignId: r.baseline_campaign_id ? String(r.baseline_campaign_id) : null,
  };
}

/**
 * Normalizes AgentOpsSnapshot array.
 */
export function normalizeAgents(raw: unknown[]): LiveOpsAgentSnapshot[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a): a is Record<string, unknown> => Boolean(a && typeof a === "object"))
    .map((a) => ({
      agentId: String(a.agent_id || a.agentId || "unknown"),
      role: String(a.role || a.agent_id || "agent"),
      state: (a.state || "idle") as LiveOpsAgentSnapshot["state"],
      currentTask: a.current_task ? String(a.current_task) : null,
      lastEventId: a.last_event_id ? String(a.last_event_id) : null,
      latencyMs: toOptionalNumber(a.latency_ms ?? a.latencyMs),
      risk: toOptionalNumber(a.risk),
      currentRound: toOptionalNumber(a.current_round ?? a.currentRound),
    }));
}

/**
 * Normalizes the full REST snapshot from GET /api/v1/telemetry/ops.
 * Handles current_campaign = null gracefully without throwing.
 */
export function normalizeSnapshot(raw: unknown): Omit<LiveOpsState, "connection" | "error"> {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid snapshot payload");
  }
  const r = raw as Record<string, unknown>;

  const rawCampaign = r.current_campaign as Record<string, unknown> | null | undefined;
  let currentCampaign: LiveOpsCampaign | null = null;
  if (rawCampaign && typeof rawCampaign === "object") {
    currentCampaign = {
      id: String(rawCampaign.id || ""),
      name: String(rawCampaign.name || ""),
      status: String(rawCampaign.status || ""),
      roundsCompleted: Number(rawCampaign.rounds_completed ?? 0),
      totalRounds: toOptionalNumber(rawCampaign.total_rounds ?? rawCampaign.max_rounds) ?? undefined,
    };
  }

  const rawEvents = Array.isArray(r.events) ? r.events : [];
  const events: LiveOpsSecurityEvent[] = [];
  const seenIds = new Set<string>();

  for (const item of rawEvents) {
    const evt = normalizeSecurityEvent(item);
    if (evt && !seenIds.has(evt.eventId)) {
      seenIds.add(evt.eventId);
      events.push(evt);
    }
  }

  const timeline = events.map(eventToTimelineStep);

  const rawActions = Array.isArray(r.operator_actions) ? r.operator_actions : DEFAULT_OPERATOR_ACTIONS;
  const operatorActions: LiveOpsOperatorActionSpec[] = rawActions
    .filter((a): a is Record<string, unknown> => Boolean(a && typeof a === "object"))
    .map((a) => ({
      actionId: String(a.action_id || a.actionId || ""),
      implemented: Boolean(a.implemented),
      method: a.method ? String(a.method) : null,
      path: a.path ? String(a.path) : null,
      note: String(a.note || ""),
    }));

  const mode = String(r.telemetry_mode || "DISCONNECTED").toUpperCase();
  const validMode: LiveTelemetryMode =
    mode === "LIVE" ? "LIVE" : mode === "STALE" ? "STALE" : mode === "SIMULATION" ? "SIMULATION" : "DISCONNECTED";

  return {
    telemetryMode: validMode,
    isLive: validMode === "LIVE",
    tenantId: r.tenant_id ? String(r.tenant_id) : null,
    currentCampaign,
    currentSession: r.current_session_id ? String(r.current_session_id) : null,
    currentRound: toOptionalNumber(r.current_round),
    agents: normalizeAgents(Array.isArray(r.agents) ? r.agents : []),
    events,
    timeline,
    metrics: normalizeDetectionMetrics(r.metrics),
    circuitBreaker: INITIAL_CIRCUIT_BREAKER,
    operatorActions,
  };
}

/**
 * Builds the simulation fallback state when backend is unreachable or offline.
 * Clearly tags telemetryMode as "SIMULATION" and isLive as false.
 */
export function buildSimulationFallbackState(currentRoundIdx = 0): LiveOpsState {
  const round: LiveRound = LIVE_ROUNDS[currentRoundIdx % LIVE_ROUNDS.length] ?? LIVE_ROUNDS[0]!;

  const agents: LiveOpsAgentSnapshot[] = Object.entries(round.agents).map(([role, state]) => ({
    agentId: role.toLowerCase().replace(/\s+/g, "_"),
    role,
    state: state as LiveOpsAgentSnapshot["state"],
    currentTask: null,
    lastEventId: `sim_evt_r${round.round}`,
    latencyMs: round.latencies ? round.latencies[role as keyof typeof round.agents] ?? null : null,
    risk: null,
    currentRound: round.round,
  }));

  const timeline: AttackTimelineStep[] = LIVE_ROUNDS.map((r) => ({
    round: r.round,
    label: `R${r.round} · ${r.bars[0]?.code ?? "SIM"}`,
    whatHappened: r.prompt,
    when: `T+${r.round * 4}s`,
    whatDetectedIt: r.verdicts[0]?.detail ?? "Simulated Detector",
    actionTaken: r.statusBadge ?? "MONITORED",
    status: r.badgeTone === "error" ? "contained" : r.badgeTone === "warning" ? "suspicious" : "nominal",
    agentFrom: r.from,
    agentTo: r.to,
    threatCode: r.bars[0]?.code ?? "ASI01",
    eventId: `sim_evt_r${r.round}`,
    traceId: `sim_trace_r${r.round}`,
  }));

  return {
    telemetryMode: "SIMULATION",
    isLive: false,
    tenantId: "simulation_org",
    currentCampaign: {
      id: "SIM-CAMPAIGN-001",
      name: "Tactical Glass Cockpit Simulation",
      status: "RUNNING",
      roundsCompleted: round.round,
      totalRounds: LIVE_ROUNDS.length,
    },
    currentSession: "SIM-SESSION-001",
    currentRound: round.round,
    agents,
    events: [],
    timeline,
    metrics: {
      judged: round.round,
      truePositive: Math.round(round.round * 0.8),
      falseNegative: Math.max(0, round.round - Math.round(round.round * 0.8)),
      falsePositive: 0,
      trueNegative: null,
      detectionRate: round.kpis?.detectionRate ?? 82,
      precision: 91,
      recall: 85,
      falsePositiveRate: 4,
      falseNegativeRate: 15,
      detectionLatencyMs: 38,
      containmentRate: 78,
      adaptiveDetection: round.kpis?.detectionRate ?? 82,
      baselineDetection: 65,
      adaptiveLift: 17,
      adaptiveCampaignId: "SIM-CAMPAIGN-001",
      baselineCampaignId: "SIM-BASELINE-001",
    },
    circuitBreaker: {
      status: "unsupported",
      note: "Simulation fallback active. Backend telemetry unreachable.",
    },
    connection: {
      ...INITIAL_CONNECTION_STATE,
      connected: false,
    },
    operatorActions: DEFAULT_OPERATOR_ACTIONS,
    error: null,
  };
}

// ---------------------------------------------------------------------------
// OPERATOR CONTAINMENT ACTION CALLS
// ---------------------------------------------------------------------------

/**
 * Authoritative operator session action.
 * Sends POST /api/v1/sessions/{session_id}/action.
 * Handles 200, 403, 404, 500, and network failures with typed results.
 */
export async function executeOperatorAction(
  sessionId: string,
  action: OperatorActionType
): Promise<OperatorActionResult> {
  const cleanSessionId = typeof sessionId === "string" ? sessionId.trim() : "";
  if (!cleanSessionId) {
    return {
      success: false,
      action,
      sessionId: String(sessionId || ""),
      error: "Invalid session ID provided for operator action",
    };
  }

  const endpoint = `/api/v1/sessions/${encodeURIComponent(cleanSessionId)}/action`;
  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify({ action }),
    });

    if (res.status === 401) {
      return {
        success: false,
        action,
        sessionId: cleanSessionId,
        statusCode: 401,
        error: "Unauthorized: Operator containment requires authentication.",
      };
    }

    if (res.status === 403) {
      return {
        success: false,
        action,
        sessionId: cleanSessionId,
        statusCode: 403,
        error: "Forbidden: containment action requires elevated operator permissions.",
      };
    }

    if (res.status === 404) {
      return {
        success: false,
        action,
        sessionId: cleanSessionId,
        statusCode: 404,
        error: `Session ${cleanSessionId} was not found or tenant mismatch occurred.`,
      };
    }

    if (!res.ok) {
      let errorMsg = `Server returned status ${res.status}`;
      try {
        const body = await res.json();
        const unwrapped = unwrapEnvelope(body) as Record<string, any>;
        const errObj =
          unwrapped?.error && typeof unwrapped.error === "object"
            ? unwrapped.error
            : unwrapped;
        if (errObj?.detail || errObj?.message) {
          errorMsg = String(errObj.detail || errObj.message);
        }
      } catch {
        // use status message
      }
      return {
        success: false,
        action,
        sessionId: cleanSessionId,
        statusCode: res.status,
        error: errorMsg,
      };
    }

    const raw = await res.json();
    const data = (unwrapEnvelope(raw) as Record<string, any>) || {};

    return {
      success: true,
      action,
      sessionId: cleanSessionId,
      statusCode: res.status,
      data: {
        sessionId: String(data.session_id || cleanSessionId),
        enforcedAction: String(data.enforced_action || action),
        status: String(data.status || ""),
        idempotent: Boolean(data.idempotent),
        traceId: data.trace_id ? String(data.trace_id) : undefined,
        eventId: data.event_id ? String(data.event_id) : undefined,
      },
    };
  } catch (err: unknown) {
    return {
      success: false,
      action,
      sessionId: cleanSessionId,
      error: err instanceof Error ? err.message : "Network failure connecting to containment API",
    };
  }
}

// ---------------------------------------------------------------------------
// MAIN REACT HOOK
// ---------------------------------------------------------------------------

export function useCommandCenterLiveOps(options: UseCommandCenterLiveOpsOptions = {}) {
  const {
    enabled = true,
    pollIntervalMs = 8_000,
    staleThresholdMs = STALE_THRESHOLD_MS_DEFAULT,
    forceSimulation = false,
  } = options;

  const [state, setState] = useState<LiveOpsState>(() => buildSimulationFallbackState(0));
  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const lastEventTimestampRef = useRef<number | null>(null);

  // 1. Snapshot fetcher (REST GET /api/v1/telemetry/ops)
  const fetchSnapshot = useCallback(async () => {
    if (forceSimulation || !enabled) return;

    try {
      const data = await fetchFromBackend<Record<string, unknown>>("/api/v1/telemetry/ops", { silent: true });
      if (!data) {
        // Backend unavailable -> fallback to simulation
        setState({
          ...buildSimulationFallbackState(0),
          error: "Telemetry endpoint returned null — simulation mode active",
        });
        return;
      }

      const normalized = normalizeSnapshot(data);

      // Populate deduplication set from snapshot
      for (const evt of normalized.events) {
        seenEventIdsRef.current.add(evt.eventId);
      }

      if (normalized.events.length > 0) {
        lastEventTimestampRef.current = Date.now();
      }

      setState((prev) => ({
        ...prev,
        ...normalized,
        connection: {
          ...prev.connection,
          lastEventAt: normalized.events[0]?.timestamp ?? prev.connection.lastEventAt,
        },
        error: null,
      }));
    } catch (err: unknown) {
      setState({
        ...buildSimulationFallbackState(0),
        error: err instanceof Error ? err.message : "Failed to load operational snapshot",
      });
    }
  }, [enabled, forceSimulation]);

  // Initial load & optional light polling fallback
  useEffect(() => {
    if (!enabled || forceSimulation) {
      setState(buildSimulationFallbackState(0));
      return;
    }

    void fetchSnapshot();

    if (pollIntervalMs > 0) {
      const timer = setInterval(() => {
        void fetchSnapshot();
      }, pollIntervalMs);
      return () => clearInterval(timer);
    }
  }, [enabled, fetchSnapshot, forceSimulation, pollIntervalMs]);

  // 2. Live WebSocket Ingestion (/websocket)
  const handleWsMessage = useCallback((payload: unknown) => {
    if (!payload || typeof payload !== "object") return;
    const msg = payload as Record<string, unknown>;

    // Handle telemetry, history, and replay frames
    let candidateEvents: unknown[] = [];
    if (msg.type === "telemetry" && msg.event) {
      candidateEvents = [msg.event];
    } else if (msg.type === "telemetry" && (msg.event_id || msg.eventId)) {
      candidateEvents = [msg];
    } else if ((msg.type === "history" || msg.type === "replay") && Array.isArray(msg.events)) {
      candidateEvents = msg.events;
    } else if (msg.event_id || msg.eventId) {
      // Direct event frame
      candidateEvents = [msg];
    }

    if (candidateEvents.length === 0) return;

    // Bound seen event IDs memory to prevent unbounded leaks on long campaigns
    if (seenEventIdsRef.current.size > 2000) {
      const arr = Array.from(seenEventIdsRef.current);
      seenEventIdsRef.current = new Set(arr.slice(arr.length - 1000));
    }

    const newNormalizedEvents: LiveOpsSecurityEvent[] = [];
    for (const raw of candidateEvents) {
      const normalized = normalizeSecurityEvent(raw);
      if (normalized && !seenEventIdsRef.current.has(normalized.eventId)) {
        seenEventIdsRef.current.add(normalized.eventId);
        newNormalizedEvents.push(normalized);
      }
    }

    if (newNormalizedEvents.length === 0) return;

    const now = Date.now();
    lastEventTimestampRef.current = now;

    setState((prev) => {
      const mergedEvents = [...newNormalizedEvents, ...prev.events].slice(0, MAX_EVENTS_IN_MEMORY);
      const newTimelineSteps = newNormalizedEvents.map((evt, idx) => eventToTimelineStep(evt, idx));
      const mergedTimeline = [...newTimelineSteps, ...prev.timeline].slice(0, MAX_EVENTS_IN_MEMORY);

      return {
        ...prev,
        telemetryMode: "LIVE",
        isLive: true,
        events: mergedEvents,
        timeline: mergedTimeline,
        currentSession: newNormalizedEvents[0]?.sessionId ?? prev.currentSession,
        connection: {
          ...prev.connection,
          lastEventAt: new Date(now).toISOString(),
        },
      };
    });
  }, []);

  const handleWsOpen = useCallback(() => {
    setState((prev) => ({
      ...prev,
      connection: {
        ...prev.connection,
        connected: true,
        lastConnectedAt: new Date().toISOString(),
      },
    }));
  }, []);

  const handleWsClose = useCallback(() => {
    setState((prev) => ({
      ...prev,
      telemetryMode: prev.telemetryMode === "LIVE" ? "DISCONNECTED" : prev.telemetryMode,
      isLive: false,
      connection: {
        ...prev.connection,
        connected: false,
        reconnectCount: prev.connection.reconnectCount + 1,
      },
    }));
  }, []);

  const resolveWsUrl = useCallback(async () => {
    return buildWebSocketUrl("/api/v1/websocket");
  }, []);

  // Hook into existing authenticated reconnecting socket
  useReconnectingWebSocket("", handleWsMessage, {
    enabled: enabled && !forceSimulation,
    onOpen: handleWsOpen,
    onClose: handleWsClose,
    resolveUrl: resolveWsUrl,
  });

  // 3. Freshness / Stale State Monitor
  useEffect(() => {
    if (!enabled || forceSimulation) return;

    const interval = setInterval(() => {
      if (lastEventTimestampRef.current !== null) {
        const elapsed = Date.now() - lastEventTimestampRef.current;
        if (elapsed > staleThresholdMs) {
          setState((prev) => {
            if (prev.telemetryMode === "LIVE") {
              return {
                ...prev,
                telemetryMode: "STALE",
                isLive: false,
              };
            }
            return prev;
          });
        }
      }
    }, 5_000);

    return () => clearInterval(interval);
  }, [enabled, forceSimulation, staleThresholdMs]);

  // 4. Operator Action Handlers
  const killSession = useCallback(async (sessionId: string): Promise<OperatorActionResult> => {
    return executeOperatorAction(sessionId, "KILL");
  }, []);

  const quarantineAgent = useCallback(async (sessionId: string): Promise<OperatorActionResult> => {
    return executeOperatorAction(sessionId, "QUARANTINE");
  }, []);

  return {
    state,
    killSession,
    quarantineAgent,
    refresh: fetchSnapshot,
  };
}
