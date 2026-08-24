"use client";

import { useEffect, useState } from "react";
import { fetchFromBackend } from "@/lib/api";

export interface IntegrationStatus {
  customConnectors: number;
  alertChannels: number;
  ingestKeyConfigured: boolean;
}

const EMPTY: IntegrationStatus = {
  customConnectors: 0,
  alertChannels: 0,
  ingestKeyConfigured: false,
};

/** Fetches outbound connector counts and whether the server has an ingest API key configured. */
export function useIntegrationStatus(apiOnline: boolean) {
  const [status, setStatus] = useState<IntegrationStatus>(EMPTY);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!apiOnline) {
      setStatus(EMPTY);
      return;
    }

    setLoading(true);
    void (async () => {
      const [custom, alerts, keys] = await Promise.all([
        fetchFromBackend<{ integrations?: Array<{ enabled?: boolean }> }>("/api/v1/integrations", {
          silent: true,
        }),
        fetchFromBackend<{ integrations?: Array<{ enabled?: boolean }> }>("/api/v1/alerts/integrations", {
          silent: true,
        }),
        fetchFromBackend<{ keys?: Array<{ id: string; configured?: boolean }> }>("/api/v1/config/keys", {
          silent: true,
        }),
      ]);
      const customList = custom?.integrations ?? [];
      const alertList = alerts?.integrations ?? [];
      const keyList = keys?.keys ?? [];
      const ingestKey = keyList.find((k) => k.id === "ARTSA_API_KEY");
      setStatus({
        customConnectors: customList.filter((c) => c.enabled).length,
        alertChannels: alertList.filter((c) => c.enabled).length,
        ingestKeyConfigured: Boolean(ingestKey?.configured),
      });
      setLoading(false);
    })();
  }, [apiOnline]);

  const outboundConnected = status.customConnectors > 0 || status.alertChannels > 0;
  const outboundCount = status.customConnectors + status.alertChannels;

  return { status, loading, outboundConnected, outboundCount };
}
