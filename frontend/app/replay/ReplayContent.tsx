"use client";

import { useEffect, useState } from "react";
import { Shield, GitCompare, Microscope, Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { fetchFromBackend } from "@/lib/api";
import { formatPayload, formatResponse } from "@/lib/replayFormat";
import type { Session, ToolCallEvent } from "@/lib/types";
import { PageHeader } from "@/components/shared/PageHeader";
import { DashboardCard } from "@/components/shared/DashboardCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { RiskScore } from "@/components/shared/RiskScore";
import AutopsyReplayModal from "@/components/AutopsyReplayModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface TimelineEntry {
  event: ToolCallEvent;
  evaluation?: {
    risk_score: number;
    verdict: string;
    confidence: number;
    recommended_action: string;
    flags: string[];
    bypass_depth?: number;
  } | null;
}

export default function RoundReplayPage() {
  const searchParams = useSearchParams();
  const sessionParam = searchParams.get("session");

  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(sessionParam);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showDiff, setShowDiff] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [forensics, setForensics] = useState<Record<string, unknown> | null>(null);
  const [forensicsLoading, setForensicsLoading] = useState(false);
  const [autopsyOpen, setAutopsyOpen] = useState(false);

  useEffect(() => {
    fetchFromBackend<Session[]>("/api/v1/sessions?limit=20", { silent: true }).then((data) => {
      if (Array.isArray(data) && data.length) {
        setSessions(data);
        if (!sessionParam) setSelectedSessionId(data[0].id);
      }
      setLoadingSessions(false);
    });
  }, [sessionParam]);

  useEffect(() => {
    if (sessionParam) setSelectedSessionId(sessionParam);
  }, [sessionParam]);

  useEffect(() => {
    if (!selectedSessionId) {
      setTimeline([]);
      setSelectedIndex(0);
      return;
    }

    setLoadingTimeline(true);
    fetchFromBackend<TimelineEntry[]>(`/api/v1/sessions/${selectedSessionId}/timeline`, {
      silent: true,
    }).then((data) => {
      if (Array.isArray(data) && data.length) {
        setTimeline(data);
        setSelectedIndex(data.length - 1);
      } else {
        setTimeline([]);
        setSelectedIndex(0);
      }
      setForensics(null);
      setLoadingTimeline(false);
    });
  }, [selectedSessionId]);

  const entry = timeline[selectedIndex];
  const current = entry?.event;
  const evaluation = entry?.evaluation;
  const previous = selectedIndex > 0 ? timeline[selectedIndex - 1] : null;
  const risk = evaluation?.risk_score ?? 0;
  const sessionLabel = sessions.find((s) => s.id === selectedSessionId);

  const runForensics = async () => {
    if (!timeline.length) return;
    setForensicsLoading(true);
    const events = timeline.map((t) => ({
      tool_name: t.event.tool_name,
      arguments: t.event.arguments,
      response: t.event.response,
      risk_score: t.evaluation?.risk_score,
      verdict: t.evaluation?.verdict,
    }));
    const result = await fetchFromBackend("/api/v1/forensics/analyze", {
      method: "POST",
      body: JSON.stringify({ events, session_id: selectedSessionId }),
    });
    setForensics(result as Record<string, unknown>);
    setForensicsLoading(false);
  };

  const paneAttacker = current ? (
    <DashboardCard
      title="Attacker / Tool Call"
      badge={<Badge variant="critical">{current.agent_id}</Badge>}
      className="border-l-4 border-l-severity-critical"
    >
      <p className="text-xs text-muted-foreground">Payload · {current.tool_name}</p>
      <pre className="mt-2 max-h-48 overflow-auto rounded-lg border border-border bg-zinc-950 p-3 font-mono text-xs text-zinc-300">
        {formatPayload(current.arguments)}
      </pre>
    </DashboardCard>
  ) : null;

  const paneDefender = current ? (
    <DashboardCard
      title="Defender Response"
      badge={<Badge variant="warning">{current.latency_ms ? `${current.latency_ms}ms` : "—"}</Badge>}
      className="border-l-4 border-l-severity-high"
    >
      <pre
        className={cn(
          "mt-2 max-h-48 overflow-auto rounded-lg border border-border bg-zinc-950 p-3 font-mono text-xs",
          risk >= 80 ? "text-severity-critical" : "text-severity-high"
        )}
      >
        {formatResponse(current.response)}
      </pre>
    </DashboardCard>
  ) : null;

  const paneJudge = current ? (
    <DashboardCard
      title="Containment Judge"
      badge={<Badge variant={risk >= 80 ? "critical" : "success"}>{evaluation?.verdict ?? "—"}</Badge>}
      className="border-l-4 border-l-primary"
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-muted/20 p-3 text-center">
          <p className="text-[10px] uppercase text-muted-foreground">Risk</p>
          <p className="font-mono text-2xl font-semibold text-destructive">{risk.toFixed(1)}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-3 text-center">
          <p className="text-[10px] uppercase text-muted-foreground">Action</p>
          <p className="font-mono text-sm font-semibold">{evaluation?.recommended_action ?? "—"}</p>
        </div>
      </div>
      {evaluation?.flags?.length ? (
        <div className="mt-3 flex flex-wrap gap-1">
          {evaluation.flags.map((f) => (
            <Badge key={f} variant="warning" className="text-[10px]">
              {f}
            </Badge>
          ))}
        </div>
      ) : null}
      {sessionLabel && (
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">
          Session {sessionLabel.status} · confidence {(evaluation?.confidence ?? 0).toFixed(2)}
        </p>
      )}
    </DashboardCard>
  ) : null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Session Replay"
        description="Forensic analysis with live containment verdicts from the ingest pipeline."
        icon={<Shield className="h-5 w-5" />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setAutopsyOpen(true)} disabled={!timeline.length}>
              Autopsy mode
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={runForensics} disabled={forensicsLoading || !timeline.length}>
              {forensicsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Microscope className="h-4 w-4" />}
              Deep forensics
            </Button>
            <Button
              variant={showDiff ? "default" : "outline"}
              size="sm"
              className="gap-2"
              onClick={() => setShowDiff(!showDiff)}
              disabled={!previous}
            >
              <GitCompare className="h-4 w-4" />
              {showDiff ? "Hide diff" : "Show diff"}
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card/50 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Session</p>
          {loadingSessions ? (
            <Skeleton className="h-8 w-48" />
          ) : (
            <ScrollArea className="max-w-full">
              <div className="flex flex-wrap gap-2">
                {sessions.length === 0 ? (
                  <Badge variant="outline" className="font-mono">
                    No live sessions
                  </Badge>
                ) : (
                  sessions.map((s) => (
                    <Button
                      key={s.id}
                      variant={selectedSessionId === s.id ? "default" : "outline"}
                      size="sm"
                      className="font-mono text-xs"
                      onClick={() => setSelectedSessionId(s.id)}
                    >
                      {s.agent_id.slice(0, 12)}
                      {s.status === "BREACHED" ? " ⚠" : ""}
                    </Button>
                  ))
                )}
              </div>
            </ScrollArea>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Event:</span>
          {loadingTimeline ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            timeline.map((_, i) => (
              <Button
                key={i}
                variant={selectedIndex === i ? "default" : "outline"}
                size="sm"
                className="font-mono"
                onClick={() => setSelectedIndex(i)}
              >
                {i + 1}
              </Button>
            ))
          )}
          {evaluation && (
            <div className="flex items-center gap-2">
              <RiskScore score={risk} />
              <Badge variant={evaluation.verdict === "BREACHED" ? "critical" : "success"} className="font-mono text-[10px]">
                {evaluation.verdict}
              </Badge>
            </div>
          )}
        </div>
      </div>

      {forensics && (
        <DashboardCard title="Forensic Analysis">
          <pre className="max-h-48 overflow-auto rounded-lg border border-border bg-zinc-950 p-3 font-mono text-xs text-zinc-300">
            {JSON.stringify(forensics, null, 2)}
          </pre>
        </DashboardCard>
      )}

      {loadingTimeline ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : !current ? (
        <EmptyState
          icon={Shield}
          title="No timeline events"
          description="Ingest tool calls via POST /api/v1/ingest or run a wargame campaign."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild size="sm">
                <Link href="/campaigns">Launch wargame</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/dashboard">Command Center</Link>
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {paneAttacker}
          {paneDefender}
          {paneJudge}
        </div>
      )}

      <AutopsyReplayModal isOpen={autopsyOpen} onClose={() => setAutopsyOpen(false)} sessionId={selectedSessionId} />
    </div>
  );
}
