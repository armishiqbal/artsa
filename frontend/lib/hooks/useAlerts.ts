"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchFromBackend } from "@/lib/api";
import type { Alert } from "@/lib/types";

/** Alerts for TopNav badge — one poll loop, slower interval to reduce reload noise. */
export function useAlerts(pollMs = 60_000) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await fetchFromBackend("/api/v1/alerts", { silent: true });
    setAlerts(Array.isArray(data) ? (data as Alert[]) : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(load, pollMs);
    return () => clearInterval(interval);
  }, [load, pollMs]);

  const criticalCount = alerts.filter(
    (a) => a.severity === "CRITICAL" || a.severity === "HIGH"
  ).length;

  return { alerts, loading, criticalCount, refresh: load };
}
