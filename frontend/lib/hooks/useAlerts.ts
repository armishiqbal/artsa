"use client";

import { useEffect, useState } from "react";
import { fetchFromBackend } from "@/lib/api";
import type { Alert } from "@/lib/types";

export function useAlerts(pollMs = 10000) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const data = await fetchFromBackend("/api/v1/alerts", { silent: true });
      if (cancelled) return;
      setAlerts(Array.isArray(data) ? (data as Alert[]) : []);
      setLoading(false);
    };

    load();
    const interval = setInterval(load, pollMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pollMs]);

  const criticalCount = alerts.filter(
    (a) => a.severity === "CRITICAL" || a.severity === "HIGH"
  ).length;

  return { alerts, loading, criticalCount };
}
