"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchFromBackend } from "@/lib/api";

export interface CommandCenterAgent {
  id: string;
  name: string;
  agent_type: string;
  provider: string | null;
  model: string | null;
  status: string;
  owner: string | null;
  purpose: string | null;
  allowed_tools: string[];
  github_repositories: string[];
  enabled: boolean | null;
  session_count: number;
  breach_count: number;
  last_activity: string | null;
  last_tool_name: string | null;
  last_session_id: string | null;
  registered: boolean;
}

export interface CommandCenterAgentTimelineEntry {
  id: string;
  session_id: string;
  timestamp: string;
  tool_name: string;
  trace_id: string;
  post_exec_redacted: boolean;
  verdict: string | null;
  risk_score: number | null;
  recommended_action: string | null;
}

export function useCommandCenterAgentInventory() {
  const [agents, setAgents] = useState<CommandCenterAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<CommandCenterAgentTimelineEntry[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineUnavailable, setTimelineUnavailable] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void fetchFromBackend<CommandCenterAgent[]>("/api/v1/agents/inventory", { silent: true }).then((result) => {
      if (!active) return;
      setUnavailable(result === null);
      const rows = result ?? [];
      setAgents(rows);
      setSelectedAgentId((selected) => selected && rows.some((agent) => agent.id === selected)
        ? selected
        : rows[0]?.id ?? null);
      setLoading(false);
    });
    return () => { active = false; };
  }, [refreshKey]);

  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId) ?? null;
  const currentAgentId = selectedAgent?.id ?? null;

  useEffect(() => {
    let active = true;
    if (!currentAgentId) {
      setTimeline([]);
      setTimelineUnavailable(false);
      setTimelineLoading(false);
      return () => { active = false; };
    }
    setTimelineLoading(true);
    void fetchFromBackend<CommandCenterAgentTimelineEntry[]>(
      `/api/v1/agents/${encodeURIComponent(currentAgentId)}/evidence`,
      { silent: true },
    ).then((result) => {
      if (!active) return;
      setTimelineUnavailable(result === null);
      setTimeline(result ?? []);
      setTimelineLoading(false);
    });
    return () => { active = false; };
  }, [currentAgentId, refreshKey]);

  return {
    agents,
    loading,
    unavailable,
    selectedAgent,
    selectAgent: setSelectedAgentId,
    timeline,
    timelineLoading,
    timelineUnavailable,
    refresh,
  };
}
