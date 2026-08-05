"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadRiskFrameworkWithDemoFallback } from "@/lib/agenticRisks";
import { useConnection } from "@/lib/context/ConnectionProvider";
import { useAuthStore } from "@/lib/stores/auth";
import type { RiskFrameworkResponse } from "@/lib/types";
import { buildWebSocketUrl } from "@/lib/ws";
import { useReconnectingWebSocket } from "@/lib/hooks/useReconnectingWebSocket";

const POLL_INTERVAL_MS = 10_000;

export function useRiskFramework() {
  const [data, setData] = useState<RiskFrameworkResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [simulated, setSimulated] = useState(false);
  const { setWsConnected } = useConnection();
  const bearerToken = useAuthStore((s) => s.bearerToken);
  const wsUrl = useMemo(() => buildWebSocketUrl(), [bearerToken]);
  const lastRefreshAtRef = useRef(0);

  const refresh = useCallback(async () => {
    lastRefreshAtRef.current = Date.now();
    const { data: next, simulated: demo } = await loadRiskFrameworkWithDemoFallback();
    if (next) {
      setData(next);
      setSimulated(demo);
    }
    setLoading(false);
  }, []);

  const onWsOpen = useCallback(() => setWsConnected(true), [setWsConnected]);
  const onWsClose = useCallback(() => setWsConnected(false), [setWsConnected]);

  const handleWsMessage = useCallback(
    (payload: unknown) => {
      const message = payload as { type?: string };
      if (message.type === "telemetry" || message.type === "history") {
        if (Date.now() - lastRefreshAtRef.current >= POLL_INTERVAL_MS) {
          void refresh();
        }
      }
    },
    [refresh]
  );

  useReconnectingWebSocket(wsUrl, handleWsMessage, {
    onOpen: onWsOpen,
    onClose: onWsClose,
  });

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  return { data, loading, simulated, refresh };
}
