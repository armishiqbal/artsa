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
      try {
        const [custom, alerts, keys] = await Promise.all([
          fetchFromBackend<{ integrations?: Array<{ enabled?: boolean }> }>("/api/v1/integrations", {
            silent: true,
          }),
          fetchFromBackend<{ integrations?: Array<{ enabled?: boolean }> }>("/api/v1/alerts/integrations", {
            silent: true,
          }),
          fetchFromBackend<Record<string, unknown>>("/api/v1/config/keys", {
            silent: true,
          }),
        ]);

        const customList = Array.isArray(custom?.integrations) ? custom.integrations : [];
        const alertList = Array.isArray(alerts?.integrations) ? alerts.integrations : [];

        // Safely resolve ingestKeyConfigured regardless of whether keys is an array or object map
        let isConfigured = false;
        if (keys && typeof keys === "object") {
          const rawKeys = keys.keys ?? keys;
          if (Array.isArray(rawKeys)) {
            const match = rawKeys.find(
              (k) => k && typeof k === "object" && (k as { id?: string }).id === "ARTSA_API_KEY"
            );
            isConfigured = Boolean((match as { configured?: boolean })?.configured ?? true);
          } else if (typeof rawKeys === "object" && rawKeys !== null) {
            isConfigured = Boolean((rawKeys as Record<string, unknown>)["ARTSA_API_KEY"]);
          }
        }

        setStatus({
          customConnectors: customList.filter((c) => c?.enabled).length,
          alertChannels: alertList.filter((c) => c?.enabled).length,
          ingestKeyConfigured: isConfigured,
        });
      } catch {
        setStatus(EMPTY);
      } finally {
        setLoading(false);
      }
    })();
  }, [apiOnline]);

  const outboundConnected = status.customConnectors > 0 || status.alertChannels > 0;
  const outboundCount = status.customConnectors + status.alertChannels;

  return { status, loading, outboundConnected, outboundCount };
}
