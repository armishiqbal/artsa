"use client";

import { useEffect, useState } from "react";
import { fetchFromBackend } from "@/lib/api";
import { mergeTelemetryEvents } from "@/lib/ingestTelemetry";
import { useIntegrationStatus } from "@/lib/hooks/useIntegrationStatus";
import type { Session, ToolCallEvent } from "@/lib/types";

interface TimelineEntry {
  event: ToolCallEvent;
  evaluation?: Record<string, unknown> | null;
}

function timelineToActivity(entry: TimelineEntry): Record<string, unknown> {
  const evt = entry.event;
  const evaluation = entry.evaluation ?? {};
  const risk =
    typeof evaluation.risk_score === "number"
      ? evaluation.risk_score
      : typeof evaluation.overall_score === "number"
        ? evaluation.overall_score
        : 0;
  return {
    event_id: evt.id,
    session_id: evt.session_id,
    agent_id: evt.agent_id,
    tool_name: evt.tool_name,
    risk_score: risk,
    verdict: String(evaluation.verdict ?? ""),
    action: String(evaluation.recommended_action ?? ""),
    triggered_at: evt.timestamp,
  };
}

function sessionToActivity(session: Session): Record<string, unknown> {
  return {
    session_id: session.id,
    agent_id: session.agent_id,
    tool_name: "session",
    risk_score: session.max_risk_score,
    verdict: session.status === "BREACHED" ? "BREACHED" : session.status === "QUARANTINED" ? "SUSPICIOUS" : "SAFE",
    triggered_at: session.started_at,
  };
}

/**
 * When the WebSocket stream is empty, hydrate from telemetry REST then sessions API.
 */
export function useCommandCenterActivity(
  liveEvents: Array<Record<string, unknown>>,
  apiOnline: boolean
) {
  const [hydratedEvents, setHydratedEvents] = useState<Array<Record<string, unknown>>>([]);
  const [hydrating, setHydrating] = useState(false);
  const { status: integrationStatus, outboundConnected, outboundCount, loading: integrationStatusLoading } =
    useIntegrationStatus(apiOnline);

  useEffect(() => {
    if (!apiOnline || liveEvents.length > 0) {
      setHydratedEvents([]);
      return;
    }

    setHydrating(true);
    void (async () => {
      const recent = await fetchFromBackend<{ events?: Array<Record<string, unknown>> }>(
        "/api/v1/telemetry/recent?limit=20",
        { silent: true }
      );
      if (recent?.events?.length) {
        setHydratedEvents(recent.events);
        setHydrating(false);
        return;
      }

      const sessions = await fetchFromBackend<Session[]>("/api/v1/sessions?limit=5", { silent: true });
      if (!Array.isArray(sessions) || sessions.length === 0) {
        setHydratedEvents([]);
        setHydrating(false);
        return;
      }

      const timelineBatches = await Promise.all(
        sessions.slice(0, 2).map(async (session) => {
          const timeline = await fetchFromBackend<TimelineEntry[]>(
            `/api/v1/sessions/${session.id}/timeline`,
            { silent: true }
          );
          if (Array.isArray(timeline) && timeline.length > 0) {
            return timeline.map(timelineToActivity);
          }
          return [sessionToActivity(session)];
        })
      );

      setHydratedEvents(timelineBatches.flat());
      setHydrating(false);
    })();
  }, [apiOnline, liveEvents.length]);

  const displayEvents =
    liveEvents.length > 0
      ? liveEvents
      : mergeTelemetryEvents([], hydratedEvents);

  return {
    displayEvents,
    hydrating,
    integrationStatus,
    outboundConnected,
    outboundCount,
    integrationStatusLoading,
    usingHydrated: liveEvents.length === 0 && hydratedEvents.length > 0,
  };
}
