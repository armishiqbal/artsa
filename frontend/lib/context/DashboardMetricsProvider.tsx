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

const POLL_INTERVAL_MS = 15_000;

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

/** One WebSocket + one poll loop for the whole app shell — avoids duplicate connections per page. */
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

  const lastRefreshAtRef = useRef(0);

  const onWsOpen = useCallback(() => setWsConnected(true), [setWsConnected]);
  const onWsClose = useCallback(() => setWsConnected(false), [setWsConnected]);

  const pullTelemetryRecent = useCallback(async (mergeWithExisting = true) => {
    const recent = await fetchFromBackend<{ events?: Array<Record<string, unknown>> }>(
      "/api/v1/telemetry/recent?limit=50",
      { silent: true }
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
    lastRefreshAtRef.current = Date.now();
    const data = await fetchFromBackend<DashboardMetrics>("/api/v1/metrics/dashboard", { silent: true });
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
  }, []);

  const handleWsMessage = useCallback(
    (payload: unknown) => {
      const message = payload as {
        type?: string;
        events?: Array<Record<string, unknown>>;
        event?: Record<string, unknown>;
      };
      if (message.type === "history") {
        setLiveEvents(message.events || []);
      } else if (message.type === "telemetry" && message.event) {
        setLiveEvents((prev) => mergeTelemetryEvents(prev, [message.event!]));
        if (Date.now() - lastRefreshAtRef.current >= POLL_INTERVAL_MS) {
          void refreshMetrics();
        }
      }
    },
    [refreshMetrics]
  );

  const connected = useReconnectingWebSocket("", handleWsMessage, {
    enabled: apiOnline && authHydrated,
    onOpen: onWsOpen,
    onClose: onWsClose,
    resolveUrl: resolveWsUrl,
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
    const interval = setInterval(refreshMetrics, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [apiOnline, authHydrated, refreshMetrics, setWsConnected]);

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
