"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
}

export function useDashboardMetrics() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [liveEvents, setLiveEvents] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const { setWsConnected, refresh } = useConnection();
  const bearerToken = useAuthStore((s) => s.bearerToken);
  const wsUrl = useMemo(() => buildWebSocketUrl(), [bearerToken]);

  const onWsOpen = useCallback(() => setWsConnected(true), [setWsConnected]);
  const onWsClose = useCallback(() => setWsConnected(false), [setWsConnected]);

  const refreshMetrics = useCallback(async () => {
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
        void refreshMetrics();
      }
    },
    [refreshMetrics]
  );

  const connected = useReconnectingWebSocket(wsUrl, handleWsMessage, {
    onOpen: onWsOpen,
    onClose: onWsClose,
  });

  useEffect(() => {
    refreshMetrics();
    const interval = setInterval(refreshMetrics, 10_000);
    return () => clearInterval(interval);
  }, [refreshMetrics]);

  return { metrics, liveEvents, connected, loading, refreshMetrics };
}
