"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, GitCompare, Swords } from "lucide-react";
import { fetchFromBackend } from "@/lib/api";
import { useCampaigns } from "@/lib/hooks/useCampaigns";
import { useCampaignTranscript } from "@/lib/hooks/useCampaignTranscript";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageStack } from "@/components/shared/PageStack";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssessmentResultsPanel } from "@/components/wargame/assessment/AssessmentResultsPanel";
import { RedTeamAttackFlowGraph } from "@/components/wargame/RedTeamAttackFlowGraph";
import { RedTeamRoundStrip } from "@/components/wargame/RedTeamRoundStrip";
import { RedTeamTheater } from "@/components/wargame/RedTeamTheater";
import { JudgeVerdictPanel } from "@/components/wargame/JudgeVerdictPanel";
import { PromoteToPlaybookPanel } from "@/components/wargame/PromoteToPlaybookPanel";
import { pickFeaturedTurn } from "@/lib/campaignTranscript";
import { deriveAttackPhase } from "@/lib/redTeamAttackPhase";
import type { AttackFlowHopId } from "@/lib/redTeamAttackFlow";
import { useAppData } from "@/lib/context/AppDataProvider";

const TERMINAL = new Set(["COMPLETED", "FAILED", "CANCELLED"]);

/** Hop click focuses theater on the related round content (no decorative-only hops). */
function hopFocusesTheater(hop: AttackFlowHopId): boolean {
  return hop === "redteam" || hop === "target" || hop === "judge" || hop === "defender";
}

export default function ScanEngagementPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const { campaigns, loading: campaignsLoading } = useCampaigns();
  const { refreshCampaigns, refreshPolicies } = useAppData();

  const campaign = useMemo(
    () => campaigns.find((c) => c.id === id) ?? null,
    [campaigns, id]
  );

  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [liveRounds, setLiveRounds] = useState(0);
  const [liveMax, setLiveMax] = useState(0);
  const [liveSummary, setLiveSummary] = useState<Record<string, unknown> | null>(null);
  const [selectedHopId, setSelectedHopId] = useState<AttackFlowHopId | null>(null);

  const status = (liveStatus ?? campaign?.status ?? "UNKNOWN").toUpperCase();
  const isRunning = Boolean(id) && !TERMINAL.has(status);
  const roundsCompleted = liveRounds || campaign?.rounds_completed || 0;
  const maxRounds = liveMax || campaign?.total_rounds || 0;
  const summary =
    liveSummary ??
    ((campaign?.summary as Record<string, unknown> | undefined) ?? null);

  const { turns, loading: transcriptLoading, refresh: refreshTranscript } =
    useCampaignTranscript(id || null, summary);

  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const activeTurn =
    turns.find((t) => t.roundNumber === selectedRound) ??
    pickFeaturedTurn(turns) ??
    null;

  useEffect(() => {
    if (turns.length === 0) return;
    setSelectedRound((prev) => {
      if (prev != null && turns.some((t) => t.roundNumber === prev)) return prev;
      return pickFeaturedTurn(turns)?.roundNumber ?? turns[turns.length - 1]?.roundNumber ?? null;
    });
  }, [turns]);

  useEffect(() => {
    if (!id || !isRunning) return;
    let cancelled = false;
    const tick = async () => {
      const data = await fetchFromBackend<{
        status?: string;
        rounds_completed?: number;
        total_rounds?: number;
        max_rounds?: number;
        summary?: Record<string, unknown>;
      }>(`/api/v1/campaigns/${id}`, { silent: true });
      if (cancelled || !data) return;
      if (data.status) setLiveStatus(data.status);
      if (typeof data.rounds_completed === "number") setLiveRounds(data.rounds_completed);
      const max = Number(data.total_rounds ?? data.max_rounds);
      if (Number.isFinite(max) && max > 0) setLiveMax(max);
      if (data.summary) setLiveSummary(data.summary);
      void refreshTranscript();
      if (data.status && TERMINAL.has(data.status.toUpperCase())) {
        void refreshCampaigns();
      }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), 1500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [id, isRunning, refreshTranscript, refreshCampaigns]);

  const phase = useMemo(
    () =>
      deriveAttackPhase({
        isRunning,
        completed: TERMINAL.has(status) && status === "COMPLETED",
        roundsCompleted,
        maxRounds: maxRounds || 1,
        hasTurns: turns.length > 0,
        turn: activeTurn
          ? {
              attackPrompt: activeTurn.attackPrompt,
              targetResponse: activeTurn.targetResponse,
              verdict: activeTurn.verdict,
            }
          : null,
      }),
    [isRunning, status, roundsCompleted, maxRounds, turns.length, activeTurn]
  );

  const progressPct =
    maxRounds > 0 ? Math.min(100, Math.round((roundsCompleted / maxRounds) * 100)) : 0;

  const navigateRound = useCallback(
    (delta: number) => {
      if (!turns.length) return;
      const idx = turns.findIndex((t) => t.roundNumber === selectedRound);
      const next = Math.max(0, Math.min(turns.length - 1, (idx < 0 ? 0 : idx) + delta));
      setSelectedRound(turns[next].roundNumber);
    },
    [turns, selectedRound]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        navigateRound(-1);
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        navigateRound(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigateRound]);

  const onSelectHop = useCallback(
    (hopId: AttackFlowHopId) => {
      setSelectedHopId(hopId);
      if (hopFocusesTheater(hopId) && turns.length > 0 && selectedRound == null) {
        const featured = pickFeaturedTurn(turns);
        if (featured) setSelectedRound(featured.roundNumber);
      }
    },
    [turns, selectedRound]
  );

  if (!id) {
    return (
      <PageStack>
        <EmptyState
          icon={Swords}
          title="Scan not found"
          action={
            <Button asChild size="sm" variant="outline">
              <Link href="/campaigns">Back to scans</Link>
            </Button>
          }
        />
      </PageStack>
    );
  }

  const showResults = !isRunning && (turns.length > 0 || Boolean(summary));
  const showFlow = isRunning || turns.length > 0 || status === "COMPLETED";

  return (
    <PageStack>
      <PageHeader
        title={campaign?.name || (isRunning ? "Live engagement" : "Scan results")}
        description={
          campaign
            ? `${campaign.provider} · ${campaign.model} · ${status}`
            : isRunning
              ? "Red team engaging target…"
              : "Loading…"
        }
        icon={<Swords className="h-5 w-5" />}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/campaigns">
                <ArrowLeft className="h-3.5 w-3.5" />
                Wargame
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`/campaigns/compare?a=${id}`}>
                <GitCompare className="h-3.5 w-3.5" />
                Compare
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/campaigns?new=1">New scan</Link>
            </Button>
          </div>
        }
      />

      {showFlow ? (
        <RedTeamAttackFlowGraph
          phase={phase}
          isRunning={isRunning}
          turn={activeTurn}
          roundsCompleted={roundsCompleted}
          maxRounds={maxRounds || roundsCompleted || 1}
          targetLabel={
            campaign ? `${campaign.provider} · ${campaign.model}` : null
          }
          progressPct={isRunning ? progressPct : undefined}
          selectedHopId={selectedHopId}
          onSelectHop={onSelectHop}
        />
      ) : null}

      {campaignsLoading && !campaign && turns.length === 0 ? (
        <Skeleton className="h-48 w-full rounded-xl" />
      ) : (
        <Tabs defaultValue={isRunning || turns.length > 0 ? "engagement" : "results"}>
          <TabsList className="h-8">
            <TabsTrigger value="engagement" className="text-xs">
              Engagement
            </TabsTrigger>
            <TabsTrigger value="results" className="text-xs" disabled={!showResults && !turns.length}>
              Results
            </TabsTrigger>
          </TabsList>

          <TabsContent value="engagement" className="mt-4 space-y-4">
            {transcriptLoading && turns.length === 0 ? (
              <Skeleton className="h-[360px] w-full rounded-xl" />
            ) : turns.length === 0 ? (
              <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-[#313131] px-6 text-center">
                <p className="text-sm font-medium text-white">
                  {isRunning ? "Waiting for first probe exchange…" : "No exchanges yet"}
                </p>
                <p className="mt-1 max-w-md text-xs text-[#7c7c7c]">
                  {isRunning
                    ? "Attack flow hops light from live phase. Theater fills when round transcripts arrive."
                    : "Launch a scan to drive the attack-flow graph from real engagement data."}
                </p>
              </div>
            ) : (
              <>
                <RedTeamRoundStrip
                  turns={turns}
                  selectedRound={selectedRound}
                  onSelectRound={setSelectedRound}
                />
                <p className="font-mono text-[10px] text-[#454545]">← → navigate rounds</p>
                <RedTeamTheater turn={activeTurn} />
                <div className="grid gap-4 lg:grid-cols-2">
                  <JudgeVerdictPanel turn={activeTurn} />
                  <PromoteToPlaybookPanel
                    turn={activeTurn}
                    findingId={
                      activeTurn ? `campaign-${id}-r${activeTurn.roundNumber}` : null
                    }
                    onPromoted={() => {
                      void refreshCampaigns();
                      void refreshPolicies();
                    }}
                  />
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="results" className="mt-4">
            {turns.length > 0 || summary ? (
              <AssessmentResultsPanel
                turns={turns}
                campaignId={id}
                title={campaign?.name || id}
                subtitle={`${campaign?.provider ?? "—"} · ${campaign?.model ?? "—"}`}
              />
            ) : (
              <p className="py-12 text-center text-[13px] text-[#7c7c7c]">
                Aggregated risk results unlock when the engagement finishes.
              </p>
            )}
          </TabsContent>
        </Tabs>
      )}
    </PageStack>
  );
}
