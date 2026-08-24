"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchFromBackend } from "@/lib/api";
import {
  parseTopFindings,
  roundToTranscriptTurn,
  type TranscriptTurn,
} from "@/lib/campaignTranscript";

export function useCampaignTranscript(campaignId: string | null, summary?: Record<string, unknown> | null) {
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<"rounds" | "summary" | "none">("none");

  const refresh = useCallback(async () => {
    if (!campaignId) {
      setTurns([]);
      setSource("none");
      return;
    }

    setLoading(true);
    const roundsRes = await fetchFromBackend<{ rounds?: Array<Record<string, unknown>> }>(
      `/api/v1/campaigns/${campaignId}/rounds`,
      { silent: true }
    );

    if (roundsRes?.rounds?.length) {
      setTurns(roundsRes.rounds.map(roundToTranscriptTurn));
      setSource("rounds");
      setLoading(false);
      return;
    }

    const fromSummary = parseTopFindings(summary ?? null);
    if (fromSummary.length) {
      setTurns(fromSummary);
      setSource("summary");
    } else {
      setTurns([]);
      setSource("none");
    }
    setLoading(false);
  }, [campaignId, summary]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { turns, loading, source, refresh };
}
