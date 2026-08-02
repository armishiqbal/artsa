"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchFromBackend } from "@/lib/api";

interface ConnectionContextValue {
  apiOnline: boolean;
  wsConnected: boolean;
  activeSessions: number;
  setWsConnected: (connected: boolean) => void;
  refresh: () => Promise<void>;
}

const ConnectionContext = createContext<ConnectionContextValue>({
  apiOnline: false,
  wsConnected: false,
  activeSessions: 0,
  setWsConnected: () => {},
  refresh: async () => {},
});

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [apiOnline, setApiOnline] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [activeSessions, setActiveSessions] = useState(0);

  const refresh = useCallback(async () => {
    const data = await fetchFromBackend("/api/v1/metrics/dashboard", { silent: true });
    if (data) {
      setApiOnline(true);
      setActiveSessions(Number((data as { active_sessions?: number }).active_sessions ?? 0));
    } else {
      setApiOnline(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <ConnectionContext.Provider
      value={{ apiOnline, wsConnected, activeSessions, setWsConnected, refresh }}
    >
      {children}
    </ConnectionContext.Provider>
  );
}

export function useConnection() {
  return useContext(ConnectionContext);
}
