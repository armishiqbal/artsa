"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { fetchFromBackend } from "@/lib/api";
import { mergeTelemetryEvents } from "@/lib/ingestTelemetry";
import { useConnection } from "@/lib/context/ConnectionProvider";
import { useAuthStore, hydrateAuthStore } from "@/lib/stores/auth";
import { buildWebSocketUrl } from "@/lib/ws";
import { useReconnectingWebSocket } from "@/lib/hooks/useReconnectingWebSocket";

export interface DashboardMetrics {
  severity_counts: Record<string, number>;
  defense_layers: Record<string, number>;
  defense_score: number;
  risk_trend: Array<{ timestamp: string; risk_score: number; tool_name?: string }>;
  avg_risk_score: number;
  max_risk_score: number;
  active_sessions: number;
  event_rate: number;
  total_events: number;
}

const EMPTY_METRICS: DashboardMetrics = {
  severity_counts: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
  defense_layers: {},
  defense_score: 0,
  risk_trend: [],
  avg_risk_score: 0,
  max_risk_score: 0,
  active_sessions: 0,
  event_rate: 0,
  total_events: 0,
};

/** REST is only a safety net — live path is WebSocket (sub‑second). */
const POLL_WHEN_WS_MS = 20_000;
const POLL_WHEN_OFFLINE_MS = 500;

function severityOf(event: Record<string, unknown>): string {
  const raw = String(event.severity ?? "").toUpperCase();
  if (raw === "CRITICAL" || raw === "HIGH" || raw === "MEDIUM" || raw === "LOW") return raw;
  const risk = Number(event.risk_score ?? 0);
  if (risk >= 80) return "CRITICAL";
  if (risk >= 60) return "HIGH";
  if (risk >= 40) return "MEDIUM";
  if (risk > 0) return "LOW";
  return "LOW";
}

/** Instant KPI bump from a WS event — no HTTP round-trip. */
function applyLiveEventToMetrics(
  prev: DashboardMetrics,
  event: Record<string, unknown>
): DashboardMetrics {
  const risk = Number(event.risk_score ?? 0);
  const severity = severityOf(event);
  const total = prev.total_events + 1;
  const prevSum = prev.avg_risk_score * prev.total_events;
  const severity_counts = {
    CRITICAL: prev.severity_counts.CRITICAL ?? 0,
    HIGH: prev.severity_counts.HIGH ?? 0,
    MEDIUM: prev.severity_counts.MEDIUM ?? 0,
    LOW: prev.severity_counts.LOW ?? 0,
  };
  severity_counts[severity as keyof typeof severity_counts] =
    (severity_counts[severity as keyof typeof severity_counts] ?? 0) + 1;
  const ts = String(event.timestamp ?? event.triggered_at ?? new Date().toISOString());
  const risk_trend = [
    ...prev.risk_trend,
    { timestamp: ts, risk_score: risk, tool_name: String(event.tool_name ?? "") },
  ].slice(-48);

  return {
    ...prev,
    severity_counts,
    total_events: total,
    avg_risk_score: total > 0 ? (prevSum + risk) / total : risk,
    max_risk_score: Math.max(prev.max_risk_score, risk),
    event_rate: prev.event_rate + 1,
    risk_trend,
    active_sessions: Math.max(prev.active_sessions, 1),
  };
}

interface DashboardMetricsContextValue {
  metrics: DashboardMetrics;
  liveEvents: Array<Record<string, unknown>>;
  connected: boolean;
  loading: boolean;
  refreshMetrics: () => Promise<void>;
  appendLiveEvent: (event: Record<string, unknown>) => void;
  pullTelemetryRecent: (mergeWithExisting?: boolean) => Promise<void>;
}

const DashboardMetricsContext = createContext<DashboardMetricsContextValue | null>(null);

/** One WebSocket + light poll fallback for the whole app shell. */
export function DashboardMetricsProvider({ children }: { children: ReactNode }) {
  const [metrics, setMetrics] = useState<DashboardMetrics>(EMPTY_METRICS);
  const [liveEvents, setLiveEvents] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [authHydrated, setAuthHydrated] = useState(false);
  const { apiOnline, setWsConnected } = useConnection();
  const bearerToken = useAuthStore((s) => s.bearerToken);
  const apiKey = useAuthStore((s) => s.apiKey);

  const resolveWsUrl = useCallback(
    () => buildWebSocketUrl(undefined, { bearerToken, apiKey }),
    [bearerToken, apiKey]
  );

  const onWsOpen = useCallback(() => setWsConnected(true), [setWsConnected]);
  const onWsClose = useCallback(() => setWsConnected(false), [setWsConnected]);

  const pullTelemetryRecent = useCallback(async (mergeWithExisting = true) => {
    const recent = await fetchFromBackend<{ events?: Array<Record<string, unknown>> }>(
      "/api/v1/telemetry/recent?limit=50",
      { silent: true, timeoutMs: 2500 }
    );
    if (!recent?.events?.length) return;
    setLiveEvents((prev) =>
      mergeWithExisting ? mergeTelemetryEvents(prev, recent.events!) : recent.events!
    );
  }, []);

  const refreshMetrics = useCallback(async () => {
    if (!apiOnline || !authHydrated) {
      setMetrics(EMPTY_METRICS);
      setLoading(false);
      return;
    }
    const data = await fetchFromBackend<DashboardMetrics>("/api/v1/metrics/dashboard", {
      silent: true,
      timeoutMs: 2500,
    });
    if (data) {
      setMetrics(data);
    } else {
      setMetrics(EMPTY_METRICS);
    }
    await pullTelemetryRecent(true);
    setLoading(false);
  }, [apiOnline, authHydrated, pullTelemetryRecent]);

  const appendLiveEvent = useCallback((event: Record<string, unknown>) => {
    setLiveEvents((prev) => mergeTelemetryEvents(prev, [event]));
    setMetrics((prev) => applyLiveEventToMetrics(prev, event));
  }, []);

  const handleWsMessage = useCallback((payload: unknown) => {
    const message = payload as {
      type?: string;
      events?: Array<Record<string, unknown>>;
      event?: Record<string, unknown>;
    };
    if (message.type === "hello" || message.type === "ping" || message.type === "pong") {
      return;
    }
    if (message.type === "history" || message.type === "replay") {
      if (message.events?.length) {
        setLiveEvents((prev) => mergeTelemetryEvents(message.events!, prev));
      } else {
        setLiveEvents(message.events || []);
      }
      return;
    }
    if (message.type === "telemetry" && message.event) {
      // Millisecond path: patch UI from the WS frame — no REST wait.
      const evt = message.event;
      setLiveEvents((prev) => mergeTelemetryEvents(prev, [evt]));
      setMetrics((prev) => applyLiveEventToMetrics(prev, evt));
    }
  }, []);

  const connected = useReconnectingWebSocket("", handleWsMessage, {
    enabled: apiOnline && authHydrated,
    onOpen: onWsOpen,
    onClose: onWsClose,
    resolveUrl: resolveWsUrl,
    baseDelayMs: 250,
    maxDelayMs: 5_000,
  });

  useEffect(() => {
    hydrateAuthStore();
    const finish = () => setAuthHydrated(true);
    const unsub = useAuthStore.persist.onFinishHydration(finish);
    if (useAuthStore.persist.hasHydrated()) finish();
    return unsub;
  }, []);

  useEffect(() => {
    if (!apiOnline || !authHydrated) {
      setWsConnected(false);
      setLoading(false);
      return;
    }
    void refreshMetrics();
    // Fast poll only while WS is down; slow reconcile when WS is live.
    const delay = connected ? POLL_WHEN_WS_MS : POLL_WHEN_OFFLINE_MS;
    const interval = setInterval(() => void refreshMetrics(), delay);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshMetrics();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [apiOnline, authHydrated, refreshMetrics, setWsConnected, connected]);

  return (
    <DashboardMetricsContext.Provider
      value={{
        metrics,
        liveEvents,
        connected,
        loading,
        refreshMetrics,
        appendLiveEvent,
        pullTelemetryRecent,
      }}
    >
      {children}
    </DashboardMetricsContext.Provider>
  );
}

export function useDashboardMetrics(): DashboardMetricsContextValue {
  const ctx = useContext(DashboardMetricsContext);
  if (!ctx) {
    throw new Error("useDashboardMetrics must be used within DashboardMetricsProvider");
  }
  return ctx;
}
