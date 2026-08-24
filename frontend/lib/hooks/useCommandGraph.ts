"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchFromBackend } from "@/lib/api";
import {
  deriveCommandGraph,
  type CommandGraphModel,
  type TopologyApiPayload,
} from "@/lib/commandGraph";
import { PIPELINE_AGENT_BY_ID } from "@/lib/agentRoles";
import type { PipelineSnapshot } from "@/lib/pipelineState";

const POLL_MS = 8_000;

export function useCommandGraph(
  events: Array<Record<string, unknown>>,
  pipeline: PipelineSnapshot | null,
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

  const controlAgents = useMemo(() => {
    if (!pipeline) return [];
    return pipeline.agents.map((a) => ({
      id: a.id,
      label: PIPELINE_AGENT_BY_ID[a.id]?.label ?? a.id,
      status: a.status,
    }));
  }, [pipeline]);

  const graph: CommandGraphModel = useMemo(
    () =>
      deriveCommandGraph({
        topology,
        events,
        controlAgents,
      }),
    [topology, events, controlAgents]
  );

  return { graph, loading, refresh };
}
