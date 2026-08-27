"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchFromBackend } from "@/lib/api";
import {
  parseTopFindings,
  roundToTranscriptTurn,
  type TranscriptTurn,
} from "@/lib/campaignTranscript";

export type TranscriptSource = "rounds" | "summary" | "none" | "offline";

type Options = {
  /**
   * When false (default for Live Monitor), never invent turns from summary
   * top_findings — only `/campaigns/:id/rounds` payloads count.
   */
  allowSummaryFallback?: boolean;
};

export function useCampaignTranscript(
  campaignId: string | null,
  summary?: Record<string, unknown> | null,
  options?: Options
) {
  const allowSummaryFallback = options?.allowSummaryFallback === true;
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<TranscriptSource>("none");
  const [live, setLive] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!campaignId) {
      setTurns([]);
      setSource("none");
      setLive(false);
      setStatus(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    const roundsRes = await fetchFromBackend<{
      rounds?: Array<Record<string, unknown>>;
      status?: string;
      live?: boolean;
      count?: number;
    }>(`/api/v1/campaigns/${campaignId}/rounds`, { silent: true });

    if (roundsRes == null) {
      // Network / auth failure — keep prior turns if any; mark offline.
      setSource((prev) => (prev === "rounds" ? "rounds" : "offline"));
      setLive(false);
      setError("Could not reach rounds API");
      setLoading(false);
      return;
    }

    setStatus(roundsRes.status ?? null);
    setLive(Boolean(roundsRes.live));

    if (Array.isArray(roundsRes.rounds) && roundsRes.rounds.length > 0) {
      setTurns(roundsRes.rounds.map(roundToTranscriptTurn));
      setSource("rounds");
      setLoading(false);
      return;
    }

    // Empty rounds array is real (campaign just started) — do not fake from summary
    // unless explicitly allowed for historical/report views.
    if (allowSummaryFallback) {
      const fromSummary = parseTopFindings(summary ?? null);
      if (fromSummary.length) {
        setTurns(fromSummary);
        setSource("summary");
        setLoading(false);
        return;
      }
    }

    setTurns([]);
    setSource("none");
    setLoading(false);
  }, [campaignId, summary, allowSummaryFallback]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { turns, loading, source, live, status, error, refresh };
}
