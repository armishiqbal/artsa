"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchFromBackend } from "@/lib/api";
import {
  clampSessionCount,
  type ApiGatewayStatus,
} from "@/lib/connectionStatus";

interface ConnectionContextValue {
  apiOnline: boolean;
  wsConnected: boolean;
  activeSessions: number;
  apiGatewayStatus: ApiGatewayStatus;
  setWsConnected: (connected: boolean) => void;
  refresh: () => Promise<void>;
}

const ConnectionContext = createContext<ConnectionContextValue>({
  apiOnline: false,
  wsConnected: false,
  activeSessions: 0,
  apiGatewayStatus: "unknown",
  setWsConnected: () => {},
  refresh: async () => {},
});

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [apiOnline, setApiOnline] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [activeSessions, setActiveSessions] = useState(0);
  const [apiGatewayStatus, setApiGatewayStatus] = useState<ApiGatewayStatus>("unknown");

  const refresh = useCallback(async () => {
    const health = await fetchFromBackend<{
      api_gateway?: { status?: string };
    }>("/api/v1/health", { silent: true });

    if (health) {
      setApiOnline(true);
      const gw = health.api_gateway?.status;
      setApiGatewayStatus(gw === "fully_connected" ? "fully_connected" : "unknown");
    } else {
      setApiOnline(false);
      setApiGatewayStatus("offline");
    }

    const data = await fetchFromBackend("/api/v1/metrics/dashboard", { silent: true });
    if (data) {
      setActiveSessions(
        clampSessionCount((data as { active_sessions?: number }).active_sessions)
      );
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <ConnectionContext.Provider
      value={{
        apiOnline,
        wsConnected,
        activeSessions,
        apiGatewayStatus,
        setWsConnected,
        refresh,
      }}
    >
      {children}
    </ConnectionContext.Provider>
  );
}

export function useConnection() {
  return useContext(ConnectionContext);
}
