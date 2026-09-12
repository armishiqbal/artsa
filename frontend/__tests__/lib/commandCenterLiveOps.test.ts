import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import {
  normalizeSnapshot,
  normalizeSecurityEvent,
  normalizeHmacRecord,
  normalizeDetectionMetrics,
  normalizeAgents,
  eventToTimelineStep,
  buildSimulationFallbackState,
  executeOperatorAction,
  useCommandCenterLiveOps,
  DEFAULT_OPERATOR_ACTIONS,
  type LiveOpsSecurityEvent,
} from "@/lib/hooks/useCommandCenterLiveOps";

// Mock @/lib/api
vi.mock("@/lib/api", () => ({
  fetchFromBackend: vi.fn(),
  buildHeaders: vi.fn(() => ({ "Content-Type": "application/json", "X-Tenant-ID": "test_org" })),
  unwrapEnvelope: vi.fn((data: any) => (data?.success && data?.data ? data.data : data)),
}));

// Mock @/lib/ws
vi.mock("@/lib/ws", () => ({
  buildWebSocketUrl: vi.fn(async (path: string) => `ws://localhost:8000${path}?ticket=mock_ticket`),
}));

// Mock @/lib/hooks/useReconnectingWebSocket
let capturedWsMessage: ((payload: unknown) => void) | null = null;
let capturedWsOpen: (() => void) | null = null;
let capturedWsClose: (() => void) | null = null;

vi.mock("@/lib/hooks/useReconnectingWebSocket", () => ({
  useReconnectingWebSocket: vi.fn((_url, onMessage, options) => {
    capturedWsMessage = onMessage;
    capturedWsOpen = options?.onOpen ?? null;
    capturedWsClose = options?.onClose ?? null;
    return true;
  }),
}));

describe("Command Center Live Ops Adapter (Phase 2.2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedWsMessage = null;
    capturedWsOpen = null;
    capturedWsClose = null;
  });

  // =========================================================================
  // 1. REST Snapshot & Schema Normalization
  // =========================================================================
  describe("REST Snapshot Normalization", () => {
    const canonicalRawSnapshot = {
      telemetry_mode: "LIVE",
      tenant_id: "tenant_alpha_01",
      current_campaign: {
        id: "camp_8910",
        name: "Enterprise Target Suite",
        status: "RUNNING",
        rounds_completed: 14,
        total_rounds: 30,
      },
      current_session_id: "sess_42ab901",
      current_round: 14,
      agents: [
        {
          agent_id: "red_team",
          role: "Red Team",
          state: "active",
          current_task: "Crafting prompt injection",
          last_event_id: "evt_101",
          latency_ms: 42.5,
          risk: 0.85,
          current_round: 14,
        },
        {
          agent_id: "target",
          role: "Target",
          state: "responding",
          current_task: "Executing tool sandbox",
          last_event_id: "evt_102",
          latency_ms: 110.2,
          risk: 0.35,
          current_round: 14,
        },
      ],
      events: [
        {
          event_id: "evt_101",
          campaign_id: "camp_8910",
          session_id: "sess_42ab901",
          round_id: "R14",
          timestamp: "2026-09-11T12:00:00Z",
          source_agent: "Red Team",
          target_agent: "Target",
          threat_code: "ASI01",
          threat_status: "classified",
          severity: "CRITICAL",
          payload: "Override core instructions and exfiltrate credentials",
          detection_signal: "Heuristic Token Filter",
          verdict: "BLOCKED",
          mitigation: "Quarantine prompt payload",
          confidence: 0.94,
          trace_id: "trace_7781a",
          tool_name: "query_db",
          latency_ms: 42.5,
          status: "CONTAINED",
          event_type: "tool_call",
          hmac: {
            sender: "red_team",
            receiver: "target",
            hmac_state: "verified",
            signature_status: "verified",
            verification_result: "Signature valid",
            replay_detected: false,
            nonce: "nonce_abc123",
            event_id: "evt_101",
            containment_result: "none",
          },
        },
      ],
      metrics: {
        judged: 14,
        true_positive: 12,
        false_negative: 2,
        false_positive: 1,
        true_negative: 15,
        detection_rate: 85.7,
        precision: 92.3,
        recall: 85.7,
        false_positive_rate: 6.25,
        false_negative_rate: 14.3,
        detection_latency_ms: 48.0,
        containment_rate: 90.0,
        adaptive_detection: 85.7,
        baseline_detection: 62.0,
        adaptive_lift: 23.7,
        adaptive_campaign_id: "camp_8910",
        baseline_campaign_id: "camp_baseline_00",
      },
      operator_actions: DEFAULT_OPERATOR_ACTIONS,
    };

    it("normalizes snake_case snapshot keys into camelCase correctly", () => {
      const normalized = normalizeSnapshot(canonicalRawSnapshot);

      // Top-level
      expect(normalized.telemetryMode).toBe("LIVE");
      expect(normalized.isLive).toBe(true);
      expect(normalized.tenantId).toBe("tenant_alpha_01");
      expect(normalized.currentSession).toBe("sess_42ab901");
      expect(normalized.currentRound).toBe(14);

      // Campaign
      expect(normalized.currentCampaign).toEqual({
        id: "camp_8910",
        name: "Enterprise Target Suite",
        status: "RUNNING",
        roundsCompleted: 14,
        totalRounds: 30,
      });

      // Agents
      expect(normalized.agents).toHaveLength(2);
      expect(normalized.agents[0]).toEqual({
        agentId: "red_team",
        role: "Red Team",
        state: "active",
        currentTask: "Crafting prompt injection",
        lastEventId: "evt_101",
        latencyMs: 42.5,
        risk: 0.85,
        currentRound: 14,
      });

      // Events
      expect(normalized.events).toHaveLength(1);
      const evt = normalized.events[0]!;
      expect(evt.eventId).toBe("evt_101");
      expect(evt.campaignId).toBe("camp_8910");
      expect(evt.sessionId).toBe("sess_42ab901");
      expect(evt.roundId).toBe("R14");
      expect(evt.sourceAgent).toBe("Red Team");
      expect(evt.targetAgent).toBe("Target");
      expect(evt.threatCode).toBe("ASI01");
      expect(evt.detectionSignal).toBe("Heuristic Token Filter");
      expect(evt.latencyMs).toBe(42.5);
      expect(evt.eventType).toBe("tool_call");

      // HMAC in event
      expect(evt.hmac.signatureStatus).toBe("verified");
      expect(evt.hmac.replayDetected).toBe(false);
      expect(evt.hmac.nonce).toBe("nonce_abc123");

      // Metrics
      expect(normalized.metrics).toEqual({
        judged: 14,
        truePositive: 12,
        falseNegative: 2,
        falsePositive: 1,
        trueNegative: 15,
        detectionRate: 85.7,
        precision: 92.3,
        recall: 85.7,
        falsePositiveRate: 6.25,
        falseNegativeRate: 14.3,
        detectionLatencyMs: 48.0,
        containmentRate: 90.0,
        adaptiveDetection: 85.7,
        baselineDetection: 62.0,
        adaptiveLift: 23.7,
        adaptiveCampaignId: "camp_8910",
        baselineCampaignId: "camp_baseline_00",
      });

      // Timeline projection
      expect(normalized.timeline).toHaveLength(1);
      expect(normalized.timeline[0]?.round).toBe(14);
      expect(normalized.timeline[0]?.status).toBe("blocked");
      expect(normalized.timeline[0]?.agentFrom).toBe("Red Team");
      expect(normalized.timeline[0]?.agentTo).toBe("Target");
    });

    it("handles current_campaign = null safely without crashing (fresh tenant)", () => {
      const emptySnapshot = {
        ...canonicalRawSnapshot,
        current_campaign: null,
        current_session_id: null,
        current_round: null,
        events: [],
      };

      const normalized = normalizeSnapshot(emptySnapshot);
      expect(normalized.currentCampaign).toBeNull();
      expect(normalized.currentSession).toBeNull();
      expect(normalized.currentRound).toBeNull();
      expect(normalized.events).toEqual([]);
      expect(normalized.timeline).toEqual([]);
    });

    it("handles partial, malformed, or missing fields gracefully", () => {
      const partialSnapshot = {
        telemetry_mode: "unknown_value",
        agents: "not-an-array",
        events: null,
        metrics: {
          judged: "invalid_num",
          detection_rate: null,
        },
      };

      const normalized = normalizeSnapshot(partialSnapshot);
      expect(normalized.telemetryMode).toBe("DISCONNECTED");
      expect(normalized.isLive).toBe(false);
      expect(normalized.agents).toEqual([]);
      expect(normalized.events).toEqual([]);
      expect(normalized.timeline).toEqual([]);
      expect(normalized.metrics?.judged).toBe(0);
      expect(normalized.metrics?.detectionRate).toBeNull();
    });

    it("throws a clear error if raw snapshot is not an object", () => {
      expect(() => normalizeSnapshot(null)).toThrow("Invalid snapshot payload");
      expect(() => normalizeSnapshot("string")).toThrow("Invalid snapshot payload");
    });
  });

  // =========================================================================
  // 2. WebSocket Event Ingestion & Deduplication
  // =========================================================================
  describe("WebSocket Ingestion & Deduplication", () => {
    it("ingests live telemetry frame and normalizes it", () => {
      const rawWsEvent = {
        event_id: "evt_live_201",
        session_id: "sess_live_99",
        source_agent: "Curator",
        target_agent: "Red Team",
        threat_code: "ASI02",
        severity: "HIGH",
        payload: "Simulated probe injection",
        detection_signal: "Policy Gate",
        verdict: "QUARANTINED",
      };

      const normalized = normalizeSecurityEvent(rawWsEvent);
      expect(normalized).not.toBeNull();
      expect(normalized?.eventId).toBe("evt_live_201");
      expect(normalized?.sessionId).toBe("sess_live_99");
      expect(normalized?.sourceAgent).toBe("Curator");
      expect(normalized?.targetAgent).toBe("Red Team");
      expect(normalized?.threatCode).toBe("ASI02");
      expect(normalized?.severity).toBe("HIGH");

      const timelineStep = eventToTimelineStep(normalized!, 0);
      expect(timelineStep.status).toBe("contained");
      expect(timelineStep.agentFrom).toBe("Curator");
      expect(timelineStep.agentTo).toBe("Red Team");
    });

    it("skips event without an eventId", () => {
      const invalidEvent = {
        source_agent: "Red Team",
        payload: "no id here",
      };
      expect(normalizeSecurityEvent(invalidEvent)).toBeNull();
    });

    it("deduplicates events by eventId in snapshot", () => {
      const snapshotWithDuplicates = {
        telemetry_mode: "LIVE",
        events: [
          { event_id: "evt_dup", source_agent: "A", payload: "first" },
          { event_id: "evt_dup", source_agent: "A", payload: "second" },
          { event_id: "evt_unique", source_agent: "B", payload: "third" },
        ],
      };

      const normalized = normalizeSnapshot(snapshotWithDuplicates);
      expect(normalized.events).toHaveLength(2);
      expect(normalized.events.map((e) => e.eventId)).toEqual(["evt_dup", "evt_unique"]);
      expect(normalized.events[0]?.payload).toBe("first");
    });
  });

  // =========================================================================
  // 3. Security Boundary & Redaction
  // =========================================================================
  describe("Security Boundary & Redaction", () => {
    it("redacts bearer tokens and api keys from event payload", () => {
      const rawWithSecrets = {
        event_id: "evt_sec_01",
        payload: "Use Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 and api_key='sk-ant-live-secret-key-123456789'",
      };

      const normalized = normalizeSecurityEvent(rawWithSecrets);
      expect(normalized?.payload).toContain("Bearer [REDACTED]");
      expect(normalized?.payload).toContain("api_key=[REDACTED]");
      expect(normalized?.payload).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
      expect(normalized?.payload).not.toContain("sk-ant-live-secret-key-123456789");
    });

    it("bounds oversized payloads to 2000 characters with truncation marker", () => {
      const giantString = "A".repeat(5000);
      const raw = {
        event_id: "evt_giant",
        payload: giantString,
      };

      const normalized = normalizeSecurityEvent(raw);
      expect(normalized?.payload.length).toBeLessThan(2050);
      expect(normalized?.payload.endsWith("... [TRUNCATED]")).toBe(true);
    });

    it("does not inject hardcoded production mock identities into live state", () => {
      const liveSnapshot = {
        telemetry_mode: "LIVE",
        tenant_id: "real_tenant_88",
        current_campaign: { id: "c_real", name: "Real Campaign", status: "RUNNING" },
        current_session_id: "sess_real_77",
        events: [],
      };

      const normalized = normalizeSnapshot(liveSnapshot);
      expect(normalized.tenantId).toBe("real_tenant_88");
      expect(normalized.currentCampaign?.name).toBe("Real Campaign");
      expect(normalized.currentSession).toBe("sess_real_77");
      expect(normalized.currentCampaign?.id).not.toBe("ARTSA-REDTEAM-042");
      expect(normalized.currentSession).not.toBe("RUN-00182");
    });
  });

  // =========================================================================
  // 4. Simulation Fallback
  // =========================================================================
  describe("Simulation Fallback", () => {
    it("builds clean simulation fallback state tagged as SIMULATION, not LIVE", () => {
      const simState = buildSimulationFallbackState(0);

      expect(simState.telemetryMode).toBe("SIMULATION");
      expect(simState.isLive).toBe(false);
      expect(simState.connection.connected).toBe(false);
      expect(simState.currentCampaign?.status).toBe("RUNNING");
      expect(simState.agents.length).toBeGreaterThan(0);
      expect(simState.timeline.length).toBeGreaterThan(0);
      expect(simState.metrics?.adaptiveLift).toBeDefined();
    });
  });

  // =========================================================================
  // 5. Operator Action Handling
  // =========================================================================
  describe("Operator Action API (POST /api/v1/sessions/{session_id}/action)", () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it("executes KILL_SESSION successfully (HTTP 200)", async () => {
      const mockResponse = {
        success: true,
        data: {
          session_id: "sess_123",
          enforced_action: "KILL",
          status: "BREACHED",
          idempotent: false,
          trace_id: "tr_kill_01",
          event_id: "ev_kill_01",
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await executeOperatorAction("sess_123", "KILL");

      expect(result.success).toBe(true);
      expect(result.action).toBe("KILL");
      expect(result.sessionId).toBe("sess_123");
      expect(result.statusCode).toBe(200);
      expect(result.data?.enforcedAction).toBe("KILL");
      expect(result.data?.status).toBe("BREACHED");
      expect(result.data?.traceId).toBe("tr_kill_01");
    });

    it("executes QUARANTINE_AGENT successfully (HTTP 200)", async () => {
      const mockResponse = {
        session_id: "sess_quar",
        enforced_action: "QUARANTINE",
        status: "QUARANTINED",
        idempotent: true,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await executeOperatorAction("sess_quar", "QUARANTINE");

      expect(result.success).toBe(true);
      expect(result.action).toBe("QUARANTINE");
      expect(result.statusCode).toBe(200);
      expect(result.data?.status).toBe("QUARANTINED");
      expect(result.data?.idempotent).toBe(true);
    });

    it("handles 403 Forbidden properly with informative message", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
      });

      const result = await executeOperatorAction("sess_restricted", "KILL");

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(403);
      expect(result.error).toContain("Forbidden");
    });

    it("handles 404 Not Found (tenant mismatch or missing session)", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await executeOperatorAction("sess_missing", "QUARANTINE");

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(404);
      expect(result.error).toContain("not found or tenant mismatch");
    });

    it("handles backend error with custom error detail from envelope", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({
          success: false,
          error: { detail: "Database connection failed during session state transition" },
        }),
      });

      const result = await executeOperatorAction("sess_error", "KILL");

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(500);
      expect(result.error).toContain("Database connection failed");
    });

    it("handles network failure gracefully when fetch throws", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Connection refused"));

      const result = await executeOperatorAction("sess_offline", "KILL");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Connection refused");
    });

    it("rejects invalid session ID without attempting network call", async () => {
      const fetchSpy = vi.fn();
      global.fetch = fetchSpy;

      const result = await executeOperatorAction("", "KILL");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid session ID");
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 6. React Hook Lifecycle & State Management
  // =========================================================================
  describe("useCommandCenterLiveOps hook", () => {
    it("initializes in simulation mode when forceSimulation is true", () => {
      const { result } = renderHook(() =>
        useCommandCenterLiveOps({ forceSimulation: true })
      );

      expect(result.current.state.telemetryMode).toBe("SIMULATION");
      expect(result.current.state.isLive).toBe(false);
      expect(result.current.state.currentCampaign?.id).toBe("SIM-CAMPAIGN-001");
    });

    it("loads REST snapshot and populates state", async () => {
      const { fetchFromBackend } = await import("@/lib/api");
      vi.mocked(fetchFromBackend).mockResolvedValueOnce({
        telemetry_mode: "LIVE",
        tenant_id: "live_tenant_xyz",
        current_campaign: {
          id: "camp_live_01",
          name: "Live Red Team Exercise",
          status: "RUNNING",
          rounds_completed: 5,
        },
        current_session_id: "sess_init_1",
        current_round: 5,
        agents: [
          { agent_id: "target", role: "Target", state: "active" },
        ],
        events: [
          {
            event_id: "evt_init_1",
            source_agent: "Red Team",
            target_agent: "Target",
            payload: "Initial probe",
          },
        ],
        metrics: {
          judged: 5,
          detection_rate: 80,
        },
        operator_actions: DEFAULT_OPERATOR_ACTIONS,
      });

      const { result } = renderHook(() =>
        useCommandCenterLiveOps({ pollIntervalMs: 0 })
      );

      await waitFor(() => {
        expect(result.current.state.telemetryMode).toBe("LIVE");
      });

      expect(result.current.state.isLive).toBe(true);
      expect(result.current.state.tenantId).toBe("live_tenant_xyz");
      expect(result.current.state.currentCampaign?.name).toBe("Live Red Team Exercise");
      expect(result.current.state.events).toHaveLength(1);
      expect(result.current.state.events[0]?.eventId).toBe("evt_init_1");
    });

    it("falls back to simulation when REST snapshot returns null", async () => {
      const { fetchFromBackend } = await import("@/lib/api");
      vi.mocked(fetchFromBackend).mockResolvedValueOnce(null);

      const { result } = renderHook(() =>
        useCommandCenterLiveOps({ pollIntervalMs: 0 })
      );

      await waitFor(() => {
        expect(result.current.state.error).not.toBeNull();
      });

      expect(result.current.state.telemetryMode).toBe("SIMULATION");
      expect(result.current.state.isLive).toBe(false);
      expect(result.current.state.error).toContain("Telemetry endpoint returned null");
    });

    it("processes live WebSocket event frame and updates state", async () => {
      const { fetchFromBackend } = await import("@/lib/api");
      vi.mocked(fetchFromBackend).mockResolvedValueOnce({
        telemetry_mode: "LIVE",
        events: [],
        agents: [],
      });

      const { result } = renderHook(() =>
        useCommandCenterLiveOps({ pollIntervalMs: 0 })
      );

      await waitFor(() => {
        expect(capturedWsMessage).not.toBeNull();
      });

      // Simulate WebSocket receiving a live telemetry frame
      act(() => {
        capturedWsMessage?.({
          type: "telemetry",
          event: {
            event_id: "ws_evt_100",
            session_id: "sess_ws_01",
            source_agent: "Red Team",
            target_agent: "Target",
            threat_code: "ASI01",
            severity: "CRITICAL",
            payload: "Live injection attack",
            verdict: "BLOCKED",
          },
        });
      });

      expect(result.current.state.telemetryMode).toBe("LIVE");
      expect(result.current.state.isLive).toBe(true);
      expect(result.current.state.events).toHaveLength(1);
      expect(result.current.state.events[0]?.eventId).toBe("ws_evt_100");
      expect(result.current.state.currentSession).toBe("sess_ws_01");
      expect(result.current.state.timeline[0]?.status).toBe("blocked");

      // Verify duplicate event is ignored
      act(() => {
        capturedWsMessage?.({
          type: "telemetry",
          event: {
            event_id: "ws_evt_100",
            payload: "Duplicate injection attack",
          },
        });
      });

      expect(result.current.state.events).toHaveLength(1);
    });

    it("updates connection status on WebSocket open and close", async () => {
      const { fetchFromBackend } = await import("@/lib/api");
      vi.mocked(fetchFromBackend).mockResolvedValueOnce({
        telemetry_mode: "LIVE",
        events: [],
        agents: [],
      });

      const { result } = renderHook(() =>
        useCommandCenterLiveOps({ pollIntervalMs: 0 })
      );

      await waitFor(() => {
        expect(capturedWsOpen).not.toBeNull();
      });

      // Simulate WS connected
      act(() => {
        capturedWsOpen?.();
      });

      expect(result.current.state.connection.connected).toBe(true);
      expect(result.current.state.connection.lastConnectedAt).not.toBeNull();

      // Simulate WS disconnect
      act(() => {
        capturedWsClose?.();
      });

      expect(result.current.state.connection.connected).toBe(false);
      expect(result.current.state.connection.reconnectCount).toBe(1);
      expect(result.current.state.telemetryMode).toBe("DISCONNECTED");
      expect(result.current.state.isLive).toBe(false);
    });

    it("detects stale state when no new events arrive within threshold", async () => {
      vi.useFakeTimers();
      const { fetchFromBackend } = await import("@/lib/api");
      vi.mocked(fetchFromBackend).mockResolvedValueOnce({
        telemetry_mode: "LIVE",
        events: [
          {
            event_id: "evt_time_01",
            source_agent: "A",
            target_agent: "B",
          },
        ],
        agents: [],
      });

      const { result } = renderHook(() =>
        useCommandCenterLiveOps({ pollIntervalMs: 0, staleThresholdMs: 30_000 })
      );

      // Fast forward past initial snapshot
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(result.current.state.telemetryMode).toBe("LIVE");

      // Advance time beyond 30,000ms threshold + 5,000ms check interval
      await act(async () => {
        await vi.advanceTimersByTimeAsync(36_000);
      });

      expect(result.current.state.telemetryMode).toBe("STALE");
      expect(result.current.state.isLive).toBe(false);

      vi.useRealTimers();
    });

    it("processes WebSocket history frame with batch of events", async () => {
      const { fetchFromBackend } = await import("@/lib/api");
      vi.mocked(fetchFromBackend).mockResolvedValueOnce({
        telemetry_mode: "LIVE",
        events: [],
        agents: [],
      });

      const { result } = renderHook(() =>
        useCommandCenterLiveOps({ pollIntervalMs: 0 })
      );

      await waitFor(() => {
        expect(capturedWsMessage).not.toBeNull();
      });

      act(() => {
        capturedWsMessage?.({
          type: "history",
          events: [
            { event_id: "h_1", source_agent: "A", target_agent: "B", payload: "history item 1" },
            { event_id: "h_2", source_agent: "B", target_agent: "C", payload: "history item 2" },
          ],
        });
      });

      expect(result.current.state.events).toHaveLength(2);
      expect(result.current.state.timeline).toHaveLength(2);
    });

    it("caps in-memory events and timeline to 150 items under heavy event traffic", async () => {
      const { fetchFromBackend } = await import("@/lib/api");
      vi.mocked(fetchFromBackend).mockResolvedValueOnce({
        telemetry_mode: "LIVE",
        events: [],
        agents: [],
      });

      const { result } = renderHook(() =>
        useCommandCenterLiveOps({ pollIntervalMs: 0 })
      );

      await waitFor(() => {
        expect(capturedWsMessage).not.toBeNull();
      });

      // Send 180 distinct events
      act(() => {
        const batch = Array.from({ length: 180 }, (_, i) => ({
          event_id: `heavy_evt_${i}`,
          source_agent: "Red Team",
          target_agent: "Target",
          payload: `Payload ${i}`,
        }));
        capturedWsMessage?.({
          type: "replay",
          events: batch,
        });
      });

      expect(result.current.state.events).toHaveLength(150);
      expect(result.current.state.timeline).toHaveLength(150);
    });
  });

  describe("Additional Operator & Security Edge Cases", () => {
    it("handles 401 Unauthorized with structured operator error", async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      });

      const result = await executeOperatorAction("sess_unauth", "KILL");

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(401);
      expect(result.error).toContain("Unauthorized");

      global.fetch = originalFetch;
    });

    it("trims whitespace from sessionId in executeOperatorAction", async () => {
      const originalFetch = global.fetch;
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ session_id: "sess_padded", enforced_action: "KILL", status: "BREACHED" }),
      });
      global.fetch = fetchSpy;

      const result = await executeOperatorAction("  sess_padded  ", "KILL");

      expect(result.success).toBe(true);
      expect(result.sessionId).toBe("sess_padded");
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/sessions/sess_padded/action"),
        expect.anything()
      );

      global.fetch = originalFetch;
    });

    it("redacts secret_key, access_token, and password patterns in normalizeSecurityEvent", () => {
      const raw = {
        event_id: "evt_multi_secret",
        payload: "Config: secret_key='supersecret12345' access_token=\"at_9876543210\" password: mySecretPassword123",
      };

      const normalized = normalizeSecurityEvent(raw);
      expect(normalized?.payload).toContain("credential=[REDACTED]");
      expect(normalized?.payload).not.toContain("supersecret12345");
      expect(normalized?.payload).not.toContain("at_9876543210");
      expect(normalized?.payload).not.toContain("mySecretPassword123");
    });
  });
});

