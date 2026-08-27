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
import { type ApiGatewayStatus } from "@/lib/connectionStatus";
import { fetchFromBackend } from "@/lib/api";

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

/** Health can briefly fail during uvicorn reload or a busy campaign — don't flap the badge. */
const HEALTH_TIMEOUT_MS = 5_000;
const ONLINE_POLL_MS = 20_000;
const OFFLINE_POLL_MS = 4_000;
const FAILURES_BEFORE_OFFLINE = 2;

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [apiOnline, setApiOnline] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [activeSessions, setActiveSessions] = useState(0);
  const [apiGatewayStatus, setApiGatewayStatus] = useState<ApiGatewayStatus>("unknown");
  const failStreakRef = useRef(0);
  const onlineRef = useRef(false);

  const refresh = useCallback(async () => {
    const health = await fetchFromBackend<{
      api_gateway?: { status?: string };
    }>("/api/v1/health", { silent: true, timeoutMs: HEALTH_TIMEOUT_MS });

    if (health) {
      failStreakRef.current = 0;
      onlineRef.current = true;
      setApiOnline(true);
      const gw = health.api_gateway?.status;
      setApiGatewayStatus(gw === "fully_connected" ? "fully_connected" : "unknown");
      return;
    }

    failStreakRef.current += 1;
    // Stay "online" through a single blip (reload / GC / campaign spike).
    if (failStreakRef.current >= FAILURES_BEFORE_OFFLINE) {
      onlineRef.current = false;
      setApiOnline(false);
      setApiGatewayStatus("offline");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    const tick = async () => {
      await refresh();
      if (cancelled) return;
      const delay = onlineRef.current ? ONLINE_POLL_MS : OFFLINE_POLL_MS;
      timer = window.setTimeout(() => {
        void tick();
      }, delay);
    };

    void tick();

    const onFocus = () => {
      void refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
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
