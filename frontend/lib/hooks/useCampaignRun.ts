"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchFromBackend } from "@/lib/api";
import { toast } from "@/lib/stores/toast";

export interface CampaignRunConfig {
  provider: string;
  modelName: string;
  attackProfile: string;
  rounds: number;
  baseUrl?: string;
}

interface CampaignStatusResponse {
  status: string;
  rounds_completed?: number;
  error?: string;
}

const POLL_INTERVAL_MS = 1500;

/**
 * Owns the wargame campaign lifecycle: POST /api/v1/campaigns/run, the 1.5s
 * status-polling loop, and the resulting isRunning / logs / campaignId /
 * completed state.
 *
 * - A cancelled flag ignores in-flight fetches (and their setState calls)
 *   after unmount.
 * - The polling interval is cleared on unmount — no timer leak.
 */
export function useCampaignRun() {
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  const cancelledRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  const launch = useCallback(async (config: CampaignRunConfig) => {
    const { provider, modelName, attackProfile, rounds, baseUrl } = config;
    if (!provider) return;

    setIsRunning(true);
    setCompleted(false);
    setLogs([`[SYSTEM] Initializing wargame for ${provider}…`]);

    try {
      const data = await fetchFromBackend<{ campaign_id?: string; error?: string }>(
        "/api/v1/campaigns/run",
        {
          method: "POST",
          body: JSON.stringify({
            name: `Wargame: ${provider.toUpperCase()} (${modelName})`,
            provider,
            model: modelName,
            attack_profile: attackProfile,
            max_rounds: Number(rounds),
            base_url: baseUrl || undefined,
          }),
        }
      );

      if (cancelledRef.current) return;

      if (data?.campaign_id) {
        const cId = data.campaign_id;
        setCampaignId(cId);
        setLogs((prev) => [
          ...prev,
          `[GATEWAY] Campaign spawned: ${cId}`,
          `[WARGAME] Dispatching to ${provider} (${modelName})…`,
        ]);

        // Clear any stale poller before starting a fresh one.
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }

        intervalRef.current = setInterval(async () => {
          const statusData = await fetchFromBackend<CampaignStatusResponse>(
            `/api/v1/campaigns/${cId}`,
            { silent: true }
          );

          if (cancelledRef.current) return;

          if (statusData) {
            setLogs((prev) => [
              ...prev,
              `[TELEMETRY] ${statusData.status} · ${statusData.rounds_completed || 0}/${rounds} rounds`,
            ]);

            if (statusData.status === "COMPLETED" || statusData.status === "FAILED") {
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
              }
              setIsRunning(false);
              if (statusData.status === "COMPLETED") {
                setCompleted(true);
                toast("Campaign completed", {
                  description: "View results in Reports or Replay.",
                  variant: "success",
                });
              }
              setLogs((prev) => [
                ...prev,
                statusData.status === "COMPLETED"
                  ? `[COMPLETE] Campaign finished successfully.`
                  : `[ERROR] ${statusData.error || "Campaign failed"}`,
              ]);
            }
          }
        }, POLL_INTERVAL_MS);
      } else {
        setIsRunning(false);
      }
    } catch (e: unknown) {
      setLogs((prev) => [...prev, `[ERROR] ${e instanceof Error ? e.message : "Failed to start"}`]);
      setIsRunning(false);
    }
  }, []);

  return { isRunning, logs, campaignId, completed, launch };
}
