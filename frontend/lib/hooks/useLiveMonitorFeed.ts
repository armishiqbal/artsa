"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchFromBackend } from "@/lib/api";
import { buildWebSocketUrl } from "@/lib/ws";
import { useReconnectingWebSocket } from "@/lib/hooks/useReconnectingWebSocket";
import {
  detectionRateFromEvents,
  eventsFromRounds,
  idleAgents,
  type LiveAgentName,
  type LiveAgentState,
  type LiveMonitorEvent,
} from "@/lib/liveMonitorEvents";

const MAX_EVENTS = 400;

function mergeEvents(prev: LiveMonitorEvent[], incoming: LiveMonitorEvent[]): LiveMonitorEvent[] {
  const bySeq = new Map<number, LiveMonitorEvent>();
  for (const e of prev) bySeq.set(e.seq, e);
  for (const e of incoming) bySeq.set(e.seq, e);
  return [...bySeq.values()]
    .sort((a, b) => a.seq - b.seq)
    .slice(-MAX_EVENTS);
}

/**
 * Live Monitor feed: WebSocket primary, REST poll fallback.
 * One channel — campaign live events only.
 */
export function useLiveMonitorFeed(campaignId: string | null, follow: boolean) {
  const [events, setEvents] = useState<LiveMonitorEvent[]>([]);
  const [agents, setAgents] = useState<Record<LiveAgentName, LiveAgentState>>(idleAgents);
  const [campaignStatus, setCampaignStatus] = useState<string | null>(null);
  const [transport, setTransport] = useState<"ws" | "poll" | "offline">("offline");
  const seenRef = useRef<Set<number>>(new Set());

  const ingest = useCallback((batch: LiveMonitorEvent[]) => {
    if (!batch.length) return;
    setEvents((prev) => {
      const next = mergeEvents(prev, batch);
      return next;
    });
    const lastWithAgents = [...batch].reverse().find((e) => e.agents);
    if (lastWithAgents?.agents) {
      setAgents((prev) => ({ ...prev, ...lastWithAgents.agents }));
    }
    const statusEvt = [...batch].reverse().find((e) => e.campaign_status);
    if (statusEvt?.campaign_status) setCampaignStatus(statusEvt.campaign_status);
  }, []);

  const hydrateRest = useCallback(async () => {
    if (!campaignId) return;
    const live = await fetchFromBackend<{
      events?: LiveMonitorEvent[];
      status?: string;
    }>(`/api/v1/campaigns/${campaignId}/live/events`, { silent: true });

    if (live?.events?.length) {
      ingest(live.events);
      if (live.status) setCampaignStatus(live.status);
      return;
    }

    // Fallback: synthesize feed from persisted rounds
    const roundsRes = await fetchFromBackend<{
      rounds?: Array<Record<string, unknown>>;
      status?: string;
    }>(`/api/v1/campaigns/${campaignId}/rounds`, { silent: true });
    if (roundsRes?.rounds?.length) {
      ingest(eventsFromRounds(campaignId, roundsRes.rounds));
    }
    if (roundsRes?.status) setCampaignStatus(roundsRes.status);
  }, [campaignId, ingest]);

  useEffect(() => {
    setEvents([]);
    setAgents(idleAgents());
    setCampaignStatus(null);
    seenRef.current = new Set();
    if (campaignId) void hydrateRest();
  }, [campaignId, hydrateRest]);

  const resolveUrl = useCallback(async () => {
    if (!campaignId) return "";
    return buildWebSocketUrl(`/api/v1/campaigns/${campaignId}/live`);
  }, [campaignId]);

  const onMessage = useCallback(
    (payload: unknown) => {
      if (!payload || typeof payload !== "object") return;
      const msg = payload as Record<string, unknown>;
      const t = String(msg.type ?? "");
      if (t === "hello" && Array.isArray(msg.events)) {
        ingest(msg.events as LiveMonitorEvent[]);
        setTransport("ws");
        return;
      }
      if (t === "campaign_live" && msg.event && typeof msg.event === "object") {
        ingest([msg.event as LiveMonitorEvent]);
        setTransport("ws");
      }
    },
    [ingest]
  );

  const wsConnected = useReconnectingWebSocket("", onMessage, {
    enabled: Boolean(campaignId) && follow,
    resolveUrl: campaignId ? resolveUrl : undefined,
    onOpen: () => setTransport("ws"),
    onClose: () => setTransport((prev) => (prev === "ws" ? "poll" : prev)),
  });

  // Poll fallback when WS down
  useEffect(() => {
    if (!campaignId || !follow) return;
    if (wsConnected) return;
    setTransport("poll");
    const timer = window.setInterval(() => void hydrateRest(), 1500);
    return () => window.clearInterval(timer);
  }, [campaignId, follow, wsConnected, hydrateRest]);

  const detection = useMemo(() => detectionRateFromEvents(events), [events]);

  /** Newest first for the stream UI. */
  const stream = useMemo(() => [...events].reverse(), [events]);

  return {
    stream,
    events,
    agents,
    campaignStatus,
    detection,
    transport,
    wsConnected,
    refresh: hydrateRest,
  };
}
