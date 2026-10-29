"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Sparkles } from "lucide-react";
import { CampaignAttackViz } from "@/components/red-team/CampaignAttackViz";
import { LiveAgentTurnCards } from "@/components/red-team/LiveAgentTurnCards";
import { publishRedTeamChrome } from "@/components/red-team/RedTeamShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { buildCampaignAttackViz } from "@/lib/campaignAttackViz";
import { useCampaigns } from "@/lib/hooks/useCampaigns";
import { useLiveMonitorFeed } from "@/lib/hooks/useLiveMonitorFeed";
import {
  LIVE_AGENTS,
  formatEventTime,
  type LiveMonitorEvent,
  type LiveOutcome,
} from "@/lib/liveMonitorEvents";
import { getDemoCampaign, getDemoCampaignEvents } from "@/lib/redTeamDemoData";
import type { LiveChromeState } from "@/lib/redTeamNav";
import { cn } from "@/lib/utils";

const TERMINAL = new Set(["COMPLETED", "FAILED", "CANCELLED", "ERROR"]);
const ROW_H = 40;
const VIEWPORT_H = 280;

function outcomeBorder(outcome: LiveOutcome | null | undefined, kind: string): string {
  if (kind === "verdict") {
    if (outcome === "pass") return "border-l-[hsl(var(--severity-low))]";
    if (outcome === "fail") return "border-l-[hsl(var(--severity-critical))]";
    return "border-l-[hsl(var(--severity-medium))]";
  }
  if (kind === "attack") return "border-l-[#67b3ef]";
  if (kind === "response") return "border-l-muted-foreground/50";
  return "border-l-border";
}

/** Lightweight windowing — only paint visible rows. */
function VirtualEventStream({
  events,
  follow,
}: {
  events: LiveMonitorEvent[];
  follow: boolean;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    if (!follow || !scrollerRef.current) return;
    scrollerRef.current.scrollTop = 0;
    setScrollTop(0);
  }, [events.length, follow]);

  const total = events.length;
  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - 4);
  const visible = Math.ceil(VIEWPORT_H / ROW_H) + 8;
  const end = Math.min(total, start + visible);
  const slice = events.slice(start, end);

  return (
    <div
      ref={scrollerRef}
      className="relative overflow-y-auto rounded-md border border-border bg-background/40"
      style={{ height: VIEWPORT_H }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      role="log"
      aria-live="polite"
      aria-label="Live attack event stream"
    >
      {total === 0 ? (
        <p className="px-4 py-12 text-center text-[13px] text-muted-foreground">
          Waiting for Red Team to launch attacks — path above lights as rounds start.
        </p>
      ) : (
        <div style={{ height: total * ROW_H, position: "relative" }}>
          {slice.map((e, i) => {
            const idx = start + i;
            return (
              <div
                key={`${e.seq}-${e.kind}`}
                className={cn(
                  "absolute left-0 right-0 flex items-start gap-3 border-l-2 px-3 py-2 text-[13px]",
                  outcomeBorder(e.outcome, e.kind)
                )}
                style={{ top: idx * ROW_H, height: ROW_H }}
              >
                <span className="w-[4.5rem] shrink-0 font-mono text-[11px] text-muted-foreground">
                  {formatEventTime(e.ts)}
                </span>
                <span className="w-14 shrink-0 font-mono text-[10px] uppercase text-muted-foreground">
                  {e.kind}
                </span>
                <span className="min-w-0 flex-1 truncate text-foreground">{e.summary}</span>
                {e.round != null ? (
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    R{e.round}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TheaterInner() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";
  const searchParams = useSearchParams();
  const router = useRouter();
  const { campaigns, loading: listLoading } = useCampaigns();
  const demoCampaign = useMemo(() => getDemoCampaign(id), [id]);
  const campaign = campaigns.find((c) => c.id === id) ?? demoCampaign;
  const isDemo = Boolean(demoCampaign);

  const follow = searchParams.get("follow") !== "0";
  const [followLatest, setFollowLatest] = useState(follow);
  const [selectedRound, setSelectedRound] = useState<number | null>(null);

  const { stream, agents, campaignStatus, detection, transport, wsConnected } = useLiveMonitorFeed(
    id || null,
    followLatest
  );

  const demoEvents = useMemo(() => (isDemo ? getDemoCampaignEvents(id) : []), [isDemo, id]);
  const effectiveEvents = useMemo(() => {
    if (isDemo && stream.length === 0) return demoEvents;
    return stream;
  }, [isDemo, stream, demoEvents]);

  const viz = useMemo(() => buildCampaignAttackViz(effectiveEvents), [effectiveEvents]);
  const status = (campaignStatus ?? campaign?.status ?? (isDemo ? "COMPLETED" : "UNKNOWN")).toUpperCase();
  const running = Boolean(id) && !TERMINAL.has(status);

  const effectiveDetection = useMemo(() => {
    if (isDemo && detection.rate == null) {
      const summary = demoCampaign?.summary;
      const blocks = Number(summary?.blocks) || 10;
      const breaches = Number(summary?.breaches) || 2;
      return {
        rate: Number(summary?.detection_rate) || 83.3,
        judged: blocks + breaches,
        passed: blocks,
        spark: [100, 100, 80, 83.3],
      };
    }
    return detection;
  }, [isDemo, detection, demoCampaign]);

  const setFollow = useCallback(
    (next: boolean) => {
      setFollowLatest(next);
      const q = new URLSearchParams(searchParams.toString());
      q.set("follow", next ? "1" : "0");
      router.replace(`/red-team/monitor/${id}?${q.toString()}`, { scroll: false });
    },
    [id, router, searchParams]
  );

  useEffect(() => {
    let state: LiveChromeState = "idle";
    if (!id) state = "idle";
    else if (listLoading && !campaign) state = "connecting";
    else if (TERMINAL.has(status)) state = "ended";
    else if (!followLatest && running) state = "paused";
    else if (running && (wsConnected || transport === "poll")) state = "live";
    else if (running) state = "connecting";
    else state = "ended";
    publishRedTeamChrome(state);
  }, [id, listLoading, campaign, status, followLatest, running, wsConnected, transport]);

  // Follow latest round unless user pauses or manually picks one
  useEffect(() => {
    if (followLatest && viz.latestRound != null) {
      setSelectedRound(viz.latestRound);
    }
  }, [followLatest, viz.latestRound]);

  if (!id) {
    return (
      <p className="text-[13px] text-muted-foreground">
        Select a campaign from{" "}
        <Link href="/red-team/campaigns" className="underline-offset-2 hover:underline">
          Campaigns
        </Link>
        .
      </p>
    );
  }

  if (listLoading && !campaign) {
    return <Skeleton className="h-64 w-full" />;
  }

  const progress =
    campaign && campaign.total_rounds > 0
      ? Math.min(100, Math.round((campaign.rounds_completed / campaign.total_rounds) * 100))
      : null;

  return (
    <div className="flex min-h-[calc(100vh-12rem)] flex-col gap-3">
      {/* Pre-Flight Multi-Agent Guidance Banner */}
      {isDemo ? (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-blue-200/90 bg-blue-50/70 p-3.5 shadow-2xs">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-blue-900">
                  Pre-Flight Multi-Agent Simulation · Labeled Demonstration Suite
                </span>
                <span className="rounded bg-blue-200/80 px-1.5 py-0.2 font-mono text-[10px] font-bold text-blue-900">
                  CrewAI 6-Agent Chain
                </span>
              </div>
              <p className="mt-0.5 text-xs text-blue-800 leading-relaxed font-sans">
                Inspecting pre-flight multi-agent walkthrough for {campaign?.name}. Follow sequential turns across Research, Curator, Red Team, Target, Judge, and Defender agents with cryptographic HMAC custody tokens.
              </p>
            </div>
          </div>
          <Button asChild size="sm" className="h-7 bg-black hover:bg-slate-900 text-white font-mono text-xs gap-1.5 shadow-xs shrink-0 self-end sm:self-center">
            <Link href="/red-team/campaigns">
              View All Campaigns
            </Link>
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-border px-3 py-2.5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {isDemo ? "Pre-Flight Simulation · under Monitor" : "Live run · under Monitor"}
          </p>
          <p className="mt-0.5 text-[14px] font-medium text-foreground">
            {campaign?.name || id.slice(0, 8)}
          </p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            This is one campaign theater. The sidebar{" "}
            <Link href="/red-team/monitor" className="underline-offset-2 hover:underline">
              Monitor
            </Link>{" "}
            lists every run. All-agent traffic is under{" "}
            <Link href="/red-team/monitor/live" className="underline-offset-2 hover:underline">
              Activity
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] text-muted-foreground">
            {status}
            {campaign
              ? ` · ${campaign.rounds_completed}/${campaign.total_rounds}`
              : ""}
            {" · "}
            {isDemo ? "simulation" : transport === "ws" ? "live" : transport === "poll" ? "refreshing" : "offline"}
          </span>
          <Button
            size="sm"
            variant={followLatest ? "default" : "outline"}
            onClick={() => setFollow(!followLatest)}
          >
            {followLatest ? "Following" : "Follow"}
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/red-team/evidence?campaign=${id}`}>Evidence</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/red-team/monitor">← Monitor</Link>
          </Button>
        </div>
      </div>

      {progress != null ? (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              running ? "bg-[#67b3ef]" : "bg-[hsl(var(--severity-low))]"
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}

      {/* Agent stage */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-4">
          {LIVE_AGENTS.map((a) => {
            const st = isDemo ? "done" : (agents[a.id] ?? "idle");
            return (
              <div key={a.id} className="flex items-center gap-1.5 text-[11px]">
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    st === "running" && "animate-pulse bg-[#67b3ef] shadow-[0_0_8px_#67b3ef88]",
                    st === "done" && "bg-[hsl(var(--severity-low))]",
                    st === "idle" && "bg-muted-foreground/35",
                    st === "not_wired" && "bg-muted-foreground/20"
                  )}
                  title={st}
                />
                <span
                  className={cn(
                    st === "running" ? "font-medium text-foreground" : "text-muted-foreground"
                  )}
                >
                  {a.label}
                </span>
              </div>
            );
          })}
        </div>
        <div className="font-mono text-[11px] tabular-nums text-muted-foreground">
          detect {effectiveDetection.rate != null ? `${effectiveDetection.rate}%` : "—"}
          {" · "}
          {effectiveDetection.passed}/{effectiveDetection.judged} blocked
        </div>
      </div>

      {/* Visual attack launch theater (6-Agent Chain) */}
      <CampaignAttackViz
        model={viz}
        selectedRound={selectedRound}
        onSelectRound={(r) => {
          setSelectedRound(r);
          setFollow(false);
        }}
      />

      {/* Multi-Agent Turn Cards */}
      <LiveAgentTurnCards
        round={selectedRound ?? viz.latestRound ?? 1}
        events={effectiveEvents}
      />

      {/* Event stream */}
      <section className="min-w-0 space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Attack event stream
          </h2>
          <span className="font-mono text-[10px] text-muted-foreground">{effectiveEvents.length} events</span>
        </div>
        <VirtualEventStream events={effectiveEvents} follow={followLatest} />
      </section>
    </div>
  );
}

export default function LiveMonitorPage() {
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full" />}>
      <TheaterInner />
    </Suspense>
  );
}
