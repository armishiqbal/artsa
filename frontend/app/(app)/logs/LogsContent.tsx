"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ScrollText,
  Search,
  FileCode,
  X,
  Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DashboardCard } from "@/components/shared/DashboardCard";
import { LiveTelemetryStream, type TelemetryEvent } from "@/components/shared/LiveTelemetryStream";
import { StatCard } from "@/components/shared/StatCard";
import { LiveIndicator } from "@/components/shared/LiveIndicator";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDashboardMetrics } from "@/lib/hooks/useDashboardMetrics";
import { useConnection } from "@/lib/context/ConnectionProvider";
import { fetchFromBackend } from "@/lib/api";
import { severityFromScore } from "@/lib/severity";
import { READINESS_UI } from "@/lib/getStartedLabels";
import type { Session, ToolCallEvent } from "@/lib/types";
import { PageStack } from "@/components/shared/PageStack";
import { LogsSetupEmpty } from "@/components/logs/LogsSetupEmpty";
import { SessionLayerStrip } from "@/components/shared/SessionLayerStrip";
import { cn } from "@/lib/utils";

type SeverityFilter = "all" | "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

interface TimelineEntry {
  event: ToolCallEvent;
  evaluation?: Record<string, unknown> | null;
}

type LogEvent = TelemetryEvent;

function timelineToLogEvent(entry: TimelineEntry): LogEvent {
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
    tool_name: evt.tool_name,
    risk_score: risk,
    verdict: String(evaluation.verdict ?? ""),
    action: String(evaluation.recommended_action ?? ""),
    triggered_at: evt.timestamp,
    agent_id: evt.agent_id,
    layer_scores: evaluation.layer_scores,
    rule_based_score: evaluation.rule_based_score,
    semantic_score: evaluation.semantic_score,
    injection_score: evaluation.injection_score,
  };
}

function streamEventToLogEvent(evt: LogEvent): LogEvent {
  return evt;
}

export default function LogsContent() {
  const searchParams = useSearchParams();
  const sessionParam = searchParams.get("session")?.trim() ?? "";

  const { liveEvents, loading, metrics, pullTelemetryRecent } = useDashboardMetrics();
  const { apiOnline, wsConnected } = useConnection();
  const [query, setQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [sessionDetail, setSessionDetail] = useState<Session | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<LogEvent[]>([]);
  const [sessionLoading, setSessionLoading] = useState(false);

  useEffect(() => {
    if (!apiOnline || sessionParam) return;
    if (liveEvents.length === 0) {
      void pullTelemetryRecent(true);
    }
  }, [apiOnline, sessionParam, liveEvents.length, pullTelemetryRecent]);

  const loadSession = useCallback(async (sessionId: string) => {
    setSessionLoading(true);
    const [session, timeline] = await Promise.all([
      fetchFromBackend<Session>(`/api/v1/sessions/${sessionId}`, { silent: true }),
      fetchFromBackend<TimelineEntry[]>(`/api/v1/sessions/${sessionId}/timeline`, { silent: true }),
    ]);
    setSessionDetail(session ?? null);
    if (Array.isArray(timeline) && timeline.length) {
      setTimelineEvents(timeline.map(timelineToLogEvent));
    } else {
      setTimelineEvents([]);
    }
    setSessionLoading(false);
  }, []);

  useEffect(() => {
    if (!sessionParam) {
      setSessionDetail(null);
      setTimelineEvents([]);
      return;
    }
    void loadSession(sessionParam);
  }, [sessionParam, loadSession]);

  const baseEvents = useMemo(() => {
    const stream = liveEvents.map(streamEventToLogEvent);
    if (!sessionParam) return stream;

    const filteredStream = stream.filter(
      (e) => String(e.session_id ?? "") === sessionParam
    );

    if (timelineEvents.length > 0) {
      const streamIds = new Set(
        filteredStream.map((e) => String(e.event_id ?? e.id ?? ""))
      );
      const merged = [...timelineEvents];
      for (const e of filteredStream) {
        const id = String(e.event_id ?? e.id ?? "");
        if (!id || !streamIds.has(id)) merged.push(e);
      }
      return merged.sort((a, b) =>
        String(a.triggered_at ?? a.ts ?? "").localeCompare(String(b.triggered_at ?? b.ts ?? ""))
      );
    }

    return filteredStream;
  }, [liveEvents, sessionParam, timelineEvents]);

  const filteredEvents = useMemo(() => {
    return baseEvents.filter((evt) => {
      const score = Number(evt.risk_score ?? 0);
      const band = severityFromScore(score);
      const tool = String(evt.tool_name ?? evt.event_type ?? "").toLowerCase();
      const verdict = String(evt.verdict ?? "").toLowerCase();
      const session = String(evt.session_id ?? "").toLowerCase();
      const q = query.toLowerCase().trim();

      if (severityFilter !== "all" && band !== severityFilter) return false;
      if (q && !tool.includes(q) && !verdict.includes(q) && !session.includes(q)) return false;
      return true;
    });
  }, [baseEvents, query, severityFilter]);

  const counts = metrics?.severity_counts ?? { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };

  const getEventHref = useCallback((evt: LogEvent) => {
    const sid = String(evt.session_id ?? sessionParam ?? "");
    if (sid) return `/replay?session=${encodeURIComponent(sid)}`;
    return undefined;
  }, [sessionParam]);

  const sessionEvaluation = useMemo(() => {
    if (!timelineEvents.length) return null;
    const latest = timelineEvents[timelineEvents.length - 1];
    return {
      verdict: String(latest.verdict ?? ""),
      risk_score: Number(latest.risk_score ?? 0),
      layer_scores: latest.layer_scores as Record<string, unknown> | undefined,
      rule_based_score: latest.rule_based_score,
      semantic_score: latest.semantic_score,
      injection_score: latest.injection_score,
    } as Record<string, unknown>;
  }, [timelineEvents]);

  return (
    <PageStack>
      <PageHeader
        title={READINESS_UI.activityLogTitle}
        description={READINESS_UI.activityLogDescription}
        icon={<ScrollText className="h-5 w-5" />}
        badge={<LiveIndicator connected={apiOnline && wsConnected} className="meta-badge" />}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/get-started">Get Started</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/replay">
                <FileCode className="h-4 w-4" />
                Session replay
              </Link>
            </Button>
          </div>
        }
      />

      {sessionParam && (
        <div
          className={cn(
            "rounded-xl border border-border bg-card p-4 shadow-card sm:flex sm:items-center sm:justify-between sm:gap-4"
          )}
        >
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{READINESS_UI.sessionFocus}</p>
            <p className="mt-1 font-mono text-sm truncate">{sessionParam}</p>
            {sessionLoading ? (
              <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading session…
              </p>
            ) : sessionDetail ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">{sessionDetail.agent_id}</Badge>
                <Badge variant="secondary" className="text-[10px]">{sessionDetail.status}</Badge>
                <SeverityBadge severity={severityFromScore(sessionDetail.max_risk_score)} />
                <span className="text-xs text-muted-foreground">
                  Peak risk {sessionDetail.max_risk_score.toFixed(0)}/100
                </span>
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                {READINESS_UI.noEventsForSession}
              </p>
            )}
            <SessionLayerStrip evaluation={sessionEvaluation} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2 sm:mt-0">
            <Button asChild size="sm">
              <Link href={`/replay?session=${encodeURIComponent(sessionParam)}`}>
                <FileCode className="h-4 w-4" />
                {READINESS_UI.viewReplay}
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/logs">
                <X className="h-4 w-4" />
                {READINESS_UI.showAllSessions}
              </Link>
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Critical"
          value={counts.CRITICAL ?? 0}
          severity="CRITICAL"
          onClick={() => setSeverityFilter("CRITICAL")}
        />
        <StatCard
          label="High"
          value={counts.HIGH ?? 0}
          severity="HIGH"
          onClick={() => setSeverityFilter("HIGH")}
        />
        <StatCard
          label="Medium"
          value={counts.MEDIUM ?? 0}
          severity="MEDIUM"
          onClick={() => setSeverityFilter("MEDIUM")}
        />
        <StatCard
          label={sessionParam ? "This session" : "Stream events"}
          value={baseEvents.length}
          icon={ScrollText}
          subtitle="Click to show all"
          onClick={() => setSeverityFilter("all")}
        />
      </div>

      <DashboardCard
        title="Screening requests"
        description="Filter by severity or search tool, verdict, session id"
        contentClassName="space-y-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-md flex-1">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tool, verdict, session…"
              className="pl-9"
              aria-label="Search logs"
            />
          </div>
          <Tabs value={severityFilter} onValueChange={(v) => setSeverityFilter(v as SeverityFilter)}>
            <TabsList>
              <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
              <TabsTrigger value="CRITICAL" className="text-xs">Critical</TabsTrigger>
              <TabsTrigger value="HIGH" className="text-xs">High</TabsTrigger>
              <TabsTrigger value="MEDIUM" className="text-xs">Med</TabsTrigger>
              <TabsTrigger value="LOW" className="text-xs">Low</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Showing {filteredEvents.length} of {baseEvents.length} events
            {sessionParam ? " in this session" : ""}
          </span>
          {!apiOnline && (
            <Badge variant="warning" className="text-[10px]">Backend offline</Badge>
          )}
        </div>

        <LiveTelemetryStream
          events={filteredEvents}
          loading={loading || sessionLoading}
          height="h-[520px]"
          highlightSessionId={sessionParam || undefined}
          getEventHref={getEventHref}
          emptyAction={
            <LogsSetupEmpty
              apiOnline={apiOnline}
              wsConnected={wsConnected}
              hasEvents={baseEvents.length > 0}
            />
          }
        />
      </DashboardCard>
    </PageStack>
  );
}
