"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadRiskFramework } from "@/lib/agenticRisks";
import { useConnection } from "@/lib/context/ConnectionProvider";
import { useAuthStore } from "@/lib/stores/auth";
import type { RiskFrameworkResponse } from "@/lib/types";
import { buildWebSocketUrl } from "@/lib/ws";
import { useReconnectingWebSocket } from "@/lib/hooks/useReconnectingWebSocket";

const POLL_INTERVAL_MS = 10_000;

export function useRiskFramework() {
  const [data, setData] = useState<RiskFrameworkResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const { setWsConnected } = useConnection();
  const bearerToken = useAuthStore((s) => s.bearerToken);
  const apiKey = useAuthStore((s) => s.apiKey);
  // Async URL factory — mints a fresh single-use WS ticket per connect attempt.
  // Auth state is in the deps so a token refresh triggers a WS reconnect.
  const resolveWsUrl = useCallback(
    () => buildWebSocketUrl(undefined, { bearerToken, apiKey }),
    [bearerToken, apiKey]
  );
  const lastRefreshAtRef = useRef(0);

  const refresh = useCallback(async () => {
    lastRefreshAtRef.current = Date.now();
    const next = await loadRiskFramework();
    if (next) {
      setData(next);
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

  useReconnectingWebSocket("", handleWsMessage, {
    onOpen: onWsOpen,
    onClose: onWsClose,
    resolveUrl: resolveWsUrl,
  });

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  return { data, loading, refresh };
}
