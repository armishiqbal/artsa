"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchFromBackend } from "@/lib/api";
import { useConnection } from "@/lib/context/ConnectionProvider";
import { useAuthStore } from "@/lib/stores/auth";
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

const DEFAULT_METRICS: DashboardMetrics = {
  severity_counts: { CRITICAL: 1, HIGH: 3, MEDIUM: 8, LOW: 14 },
  defense_layers: {
    tool_validator: 98,
    rule_inspector: 92,
    semantic_inspector: 88,
    statistical_inspector: 95,
    goal_drift_classifier: 85,
    trajectory_monitor: 90,
  },
  defense_score: 94.2,
  risk_trend: [
    { timestamp: "10:00", risk_score: 12 },
    { timestamp: "11:00", risk_score: 24 },
    { timestamp: "12:00", risk_score: 18 },
    { timestamp: "13:00", risk_score: 65 },
    { timestamp: "14:00", risk_score: 30 },
    { timestamp: "15:00", risk_score: 15 },
  ],
  avg_risk_score: 18.5,
  max_risk_score: 95.0,
  active_sessions: 6,
  event_rate: 42,
  total_events: 1420,
};

const POLL_INTERVAL_MS = 10_000;

export function useDashboardMetrics() {
  const [metrics, setMetrics] = useState<DashboardMetrics>(DEFAULT_METRICS);
  const [liveEvents, setLiveEvents] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(false);
  const { setWsConnected, refresh } = useConnection();
  const bearerToken = useAuthStore((s) => s.bearerToken);
  const apiKey = useAuthStore((s) => s.apiKey);

  const resolveWsUrl = useCallback(
    () => buildWebSocketUrl(undefined, { bearerToken, apiKey }),
    [bearerToken, apiKey]
  );

  const lastRefreshAtRef = useRef(0);

  const onWsOpen = useCallback(() => setWsConnected(true), [setWsConnected]);
  const onWsClose = useCallback(() => setWsConnected(false), [setWsConnected]);

  const refreshMetrics = useCallback(async () => {
    lastRefreshAtRef.current = Date.now();
    const data = await fetchFromBackend<DashboardMetrics>("/api/v1/metrics/dashboard", { silent: true });
    if (data) {
      setMetrics(data);
      await refresh();
    }
    setLoading(false);
  }, [refresh]);

  const handleWsMessage = useCallback(
    (payload: unknown) => {
      const message = payload as { type?: string; events?: Array<Record<string, unknown>>; event?: Record<string, unknown> };
      if (message.type === "history") {
        setLiveEvents(message.events || []);
      } else if (message.type === "telemetry" && message.event) {
        setLiveEvents((prev) => [...prev.slice(-49), message.event!]);
        if (Date.now() - lastRefreshAtRef.current >= POLL_INTERVAL_MS) {
          void refreshMetrics();
        }
      }
    },
    [refreshMetrics]
  );

  const connected = useReconnectingWebSocket("", handleWsMessage, {
    onOpen: onWsOpen,
    onClose: onWsClose,
    resolveUrl: resolveWsUrl,
  });

  useEffect(() => {
    refreshMetrics();
    const interval = setInterval(refreshMetrics, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refreshMetrics]);

  return { metrics, liveEvents, connected, loading, refreshMetrics };
}
