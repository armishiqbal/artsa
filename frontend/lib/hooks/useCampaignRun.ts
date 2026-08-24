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
  useLlmJudge?: boolean;
  campaignName?: string;
}

interface CampaignStatusResponse {
  status: string;
  rounds_completed?: number;
  error?: string;
  summary?: Record<string, unknown>;
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
  const [status, setStatus] = useState<"idle" | "running" | "completed" | "failed">("idle");
  const [roundsCompleted, setRoundsCompleted] = useState(0);
  const [maxRounds, setMaxRounds] = useState(0);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cancelledRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTelemetryRef = useRef<{ status: string; rounds: number } | null>(null);

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
    const { provider, modelName, attackProfile, rounds, baseUrl, useLlmJudge, campaignName } = config;
    if (!provider) return;

    setIsRunning(true);
    setCompleted(false);
    setStatus("running");
    setRoundsCompleted(0);
    setMaxRounds(rounds);
    setSummary(null);
    setErrorMessage(null);
    lastTelemetryRef.current = null;
    setLogs([`[SYSTEM] Initializing wargame for ${provider}…`]);

    try {
      const data = await fetchFromBackend<{ campaign_id?: string; error?: string }>(
        "/api/v1/campaigns/run",
        {
          method: "POST",
          body: JSON.stringify({
            name: campaignName?.trim() || `Wargame: ${provider.toUpperCase()} (${modelName})`,
            provider,
            model: modelName,
            attack_profile: attackProfile,
            max_rounds: Number(rounds),
            base_url: baseUrl || undefined,
            ...(useLlmJudge ? { use_llm_judge: true } : {}),
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
            const roundsDone = statusData.rounds_completed ?? 0;
            const nextStatus = statusData.status;
            const prev = lastTelemetryRef.current;

            if (!prev || prev.status !== nextStatus || prev.rounds !== roundsDone) {
              lastTelemetryRef.current = { status: nextStatus, rounds: roundsDone };
              setRoundsCompleted(roundsDone);
              setLogs((prevLogs) => [
                ...prevLogs,
                `[TELEMETRY] ${nextStatus} · ${roundsDone}/${rounds} rounds`,
              ]);
            }

            if (nextStatus === "COMPLETED" || nextStatus === "FAILED") {
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
              }
              setIsRunning(false);
              if (statusData.status === "COMPLETED") {
                setCompleted(true);
                setStatus("completed");
                if (statusData.summary) {
                  setSummary(statusData.summary);
                }
                toast("Campaign completed", {
                  description: "View results in Reports or Replay.",
                  variant: "success",
                });
              } else {
                setStatus("failed");
                setErrorMessage(statusData.error ?? "Campaign failed");
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
        setStatus("failed");
      }
    } catch (e: unknown) {
      setLogs((prev) => [...prev, `[ERROR] ${e instanceof Error ? e.message : "Failed to start"}`]);
      setIsRunning(false);
      setStatus("failed");
    }
  }, []);

  const reset = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
    setLogs([]);
    setCampaignId(null);
    setCompleted(false);
    setStatus("idle");
    setRoundsCompleted(0);
    setMaxRounds(0);
    setSummary(null);
    setErrorMessage(null);
    lastTelemetryRef.current = null;
  }, []);

  return {
    isRunning,
    logs,
    campaignId,
    completed,
    status,
    roundsCompleted,
    maxRounds,
    summary,
    errorMessage,
    launch,
    reset,
  };
}
