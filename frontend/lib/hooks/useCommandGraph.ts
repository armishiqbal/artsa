"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchFromBackend } from "@/lib/api";
import {
  deriveCommandGraph,
  type CommandGraphModel,
  type TopologyApiPayload,
} from "@/lib/commandGraph";

const POLL_MS = 8_000;

/**
 * Live containment map from topology API + telemetry events.
 * No synthetic / demo nodes — idle when traffic has not arrived yet.
 */
export function useCommandGraph(
  events: Array<Record<string, unknown>>,
  apiOnline: boolean
) {
  const [topology, setTopology] = useState<TopologyApiPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!apiOnline) {
      setTopology(null);
      setLoading(false);
      return;
    }
    const data = await fetchFromBackend<TopologyApiPayload>("/api/v1/topology", {
      silent: true,
    });
    setTopology(data?.nodes?.length ? data : null);
    setLoading(false);
  }, [apiOnline]);

  useEffect(() => {
    void refresh();
    if (!apiOnline) return;
    const id = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(id);
  }, [apiOnline, refresh]);

  const graph: CommandGraphModel = useMemo(
    () =>
      deriveCommandGraph({
        topology,
        events,
      }),
    [topology, events]
  );

  return { graph, loading, refresh, hasLiveData: graph.source !== "idle" };
}
