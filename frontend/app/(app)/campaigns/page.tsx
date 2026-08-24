"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Swords, Zap, Layers, Target, RotateCcw } from "lucide-react";
import { useProviders } from "@/lib/hooks/useProviders";
import { useAuthRole } from "@/lib/hooks/useAuthRole";
import { useCampaignRun } from "@/lib/hooks/useCampaignRun";
import { useCampaigns } from "@/lib/hooks/useCampaigns";
import { useAppData } from "@/lib/context/AppDataProvider";
import { usePipelineOverview } from "@/lib/hooks/usePipelineOverview";
import { fetchFromBackend } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatCard } from "@/components/shared/StatCard";
import { PageStack } from "@/components/shared/PageStack";
import { CampaignHistory } from "@/components/wargame/CampaignHistory";
import { CampaignResults } from "@/components/wargame/CampaignResults";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCampaignTranscript } from "@/lib/hooks/useCampaignTranscript";
import { RedTeamLiveHud } from "@/components/wargame/RedTeamLiveHud";
import { RedTeamRoundStrip } from "@/components/wargame/RedTeamRoundStrip";
import { RedTeamRiskProfile } from "@/components/wargame/RedTeamRiskProfile";
import { RedTeamConsoleHero } from "@/components/wargame/RedTeamConsoleHero";
import { RedTeamEvaluationStudio } from "@/components/wargame/RedTeamEvaluationStudio";
import { RedTeamTheater } from "@/components/wargame/RedTeamTheater";
import { RedTeamFindingsPanel } from "@/components/wargame/RedTeamFindingsPanel";
import { RedTeamScanSummary } from "@/components/wargame/RedTeamScanSummary";
import { RedTeamVerdictBreakdown } from "@/components/wargame/RedTeamVerdictBreakdown";
import { RedTeamCoverageGrid } from "@/components/wargame/RedTeamCoverageGrid";
import { RedTeamQuickLinks } from "@/components/wargame/RedTeamQuickLinks";
import { MotionCard } from "@/components/motion/MotionCard";
import { JudgeVerdictPanel } from "@/components/wargame/JudgeVerdictPanel";
import { PromoteToPlaybookPanel } from "@/components/wargame/PromoteToPlaybookPanel";
import { AgentStatusStrip } from "@/components/pipeline/AgentStatusStrip";
import { asiCodesForProfileCategories } from "@/lib/asiCategories";
import { pickFeaturedTurn } from "@/lib/campaignTranscript";
import { deriveScanMetrics } from "@/lib/redTeamScanMetrics";
import type { CampaignListItem } from "@/lib/hooks/useCampaigns";

const CATEGORY_LABELS: Record<string, string> = {
  DPI: "Prompt injection",
  JBK: "Jailbreak",
  SPE: "System prompt extraction",
  DEX: "Data extraction",
  MSE: "Model supply chain",
};

const ATTACK_PROFILES = [
  {
    id: "quick_scan",
    label: "Smoke test",
    lakeraBadge: "Fast",
    description: "3 categories · single-turn probes · ~30s per round.",
    icon: Zap,
    categories: ["DPI", "JBK", "SPE"],
    weights: { DPI: 40, JBK: 35, SPE: 25 },
    mutations: false,
  },
  {
    id: "comprehensive",
    label: "Full adversarial",
    lakeraBadge: "Deep",
    description: "5 categories · mutations · multi-turn bypass attempts.",
    icon: Layers,
    categories: ["DPI", "JBK", "SPE", "DEX", "MSE"],
    weights: { DPI: 25, JBK: 25, SPE: 20, DEX: 15, MSE: 15 },
    mutations: true,
  },
] as const;

type OutputTab = "theater" | "console" | "results";

function logTone(line: string): string {
  if (line.includes("[ERROR]")) return "text-destructive";
  if (line.includes("[COMPLETE]")) return "text-status-success font-medium";
  if (line.includes("[GATEWAY]") || line.includes("[WARGAME]")) return "text-foreground";
  if (line.includes("[TELEMETRY]")) return "text-muted-foreground";
  return "text-muted-foreground/90";
}

function buildCampaignLabel(name: string, focus: string): string {
  const trimmedName = name.trim();
  const trimmedFocus = focus.trim();
  if (trimmedName) return trimmedName;
  if (trimmedFocus) return trimmedFocus.slice(0, 80);
  return "";
}

export default function RedTeamConsolePage() {
  const { providers, loading: providersLoading } = useProviders();
  const { capabilities, loading: authLoading } = useAuthRole();
  const { campaigns, loading: campaignsLoading, refresh: refreshCampaigns } = useCampaigns();
  const { refreshPolicies } = useAppData();
  const { pipeline } = usePipelineOverview();
  const {
    isRunning,
    logs,
    campaignId,
    completed,
    status,
    roundsCompleted,
    maxRounds,
    summary: runSummary,
    errorMessage,
    launch,
    reset,
  } = useCampaignRun();

  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [modelName, setModelName] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [focusObjective, setFocusObjective] = useState("");
  const [attackProfile, setAttackProfile] = useState("quick_scan");
  const [rounds, setRounds] = useState(5);
  const [baseUrl, setBaseUrl] = useState("");
  const [useLlmJudge, setUseLlmJudge] = useState(false);
  const [templateCount, setTemplateCount] = useState(0);
  const [outputTab, setOutputTab] = useState<OutputTab>("theater");
  const [historySelection, setHistorySelection] = useState<CampaignListItem | null>(null);
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  const provider = providers.find((p) => p.id === selectedProvider);
  const profileMeta = ATTACK_PROFILES.find((p) => p.id === attackProfile) ?? ATTACK_PROFILES[0];
  const canLaunch = Boolean(selectedProvider && attackProfile && rounds >= 1 && !isRunning);
  const progressPct =
    maxRounds > 0 ? Math.min(100, Math.round((roundsCompleted / maxRounds) * 100)) : 0;

  const displaySummary = runSummary ?? (historySelection?.summary as Record<string, unknown> | undefined);
  const displayCampaignId = campaignId ?? historySelection?.id ?? null;

  const { turns: transcriptTurns, loading: transcriptLoading, refresh: refreshTranscript } =
    useCampaignTranscript(displayCampaignId, displaySummary ?? null);

  const featuredTurn = pickFeaturedTurn(transcriptTurns);
  const activeTurn =
    transcriptTurns.find((t) => t.roundNumber === selectedRound) ?? featuredTurn ?? null;

  const profileAsi = asiCodesForProfileCategories([...profileMeta.categories]);
  const roundsEstimateMin = Math.max(
    1,
    Math.round(rounds * (profileMeta.id === "quick_scan" ? 0.5 : 1))
  );

  const scanMetrics = useMemo(
    () => deriveScanMetrics(displaySummary, transcriptTurns),
    [displaySummary, transcriptTurns]
  );

  const stats = useMemo(() => {
    const completedRuns = campaigns.filter((c) => c.status === "COMPLETED");
    const successScores = completedRuns
      .map((c) => Number((c.summary as Record<string, unknown> | undefined)?.avg_attack_success))
      .filter((n) => Number.isFinite(n));
    const avgSuccess =
      successScores.length > 0
        ? (successScores.reduce((a, b) => a + b, 0) / successScores.length).toFixed(1)
        : "—";
    return {
      total: campaigns.length,
      completed: completedRuns.length,
      avgSuccess,
    };
  }, [campaigns]);

  const scanAgents = useMemo(
    () =>
      pipeline.agents.filter((a) =>
        ["research", "curator", "redteam", "target", "judge"].includes(a.id)
      ),
    [pipeline.agents]
  );

  useEffect(() => {
    fetchFromBackend<{ templates?: unknown[] }>("/api/v1/attack-library", { silent: true }).then((d) => {
      if (d?.templates) setTemplateCount(d.templates.length);
    });
  }, []);

  useEffect(() => {
    if (provider && !modelName) setModelName(provider.model);
  }, [provider, modelName]);

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [logs]);

  useEffect(() => {
    if (completed) {
      setOutputTab("results");
      void refreshCampaigns();
      void refreshTranscript();
    }
  }, [completed, refreshCampaigns, refreshTranscript]);

  useEffect(() => {
    if (transcriptTurns.length === 0) return;
    setSelectedRound((prev) => {
      if (prev != null && transcriptTurns.some((t) => t.roundNumber === prev)) return prev;
      return pickFeaturedTurn(transcriptTurns)?.roundNumber ?? transcriptTurns[0].roundNumber;
    });
  }, [transcriptTurns]);

  const navigateRound = useCallback(
    (delta: number) => {
      if (!transcriptTurns.length) return;
      const idx = transcriptTurns.findIndex((t) => t.roundNumber === selectedRound);
      const nextIdx = Math.max(0, Math.min(transcriptTurns.length - 1, idx + delta));
      setSelectedRound(transcriptTurns[nextIdx].roundNumber);
      setOutputTab("theater");
    },
    [transcriptTurns, selectedRound]
  );

  useEffect(() => {
    if (outputTab !== "theater" || transcriptTurns.length === 0) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.metaKey ||
        event.ctrlKey
      ) {
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        navigateRound(-1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        navigateRound(1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [outputTab, transcriptTurns.length, navigateRound]);

  const handleProviderSelect = (pId: string) => {
    setSelectedProvider(pId);
    const found = providers.find((p) => p.id === pId);
    if (found) setModelName(found.model);
    setHistorySelection(null);
  };

  const handleLaunch = useCallback(() => {
    if (!selectedProvider || isRunning) return;
    setHistorySelection(null);
    setOutputTab("theater");
    setSelectedRound(null);
    void launch({
      provider: selectedProvider,
      modelName,
      attackProfile,
      rounds,
      baseUrl,
      useLlmJudge,
      campaignName: buildCampaignLabel(campaignName, focusObjective),
    });
  }, [
    selectedProvider,
    isRunning,
    launch,
    modelName,
    attackProfile,
    rounds,
    baseUrl,
    useLlmJudge,
    campaignName,
    focusObjective,
  ]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && canLaunch) {
        event.preventDefault();
        handleLaunch();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canLaunch, handleLaunch]);

  const handleHistorySelect = (campaign: CampaignListItem) => {
    setHistorySelection(campaign);
    setSelectedRound(null);
    setOutputTab(campaign.summary ? "theater" : "console");
  };

  const showScanSummary =
    scanMetrics.roundsCompleted > 0 || transcriptTurns.length > 0 || Boolean(displaySummary);

  if (!authLoading && !capabilities.can_run_campaigns) {
    return (
      <PageStack>
        <PageHeader
          title="Red Team Console"
          description="Automated adversarial testing for AI applications and agents."
          icon={<Swords className="h-5 w-5" />}
        />
        <EmptyState
          icon={Swords}
          title="Red team access restricted"
          description="Your role cannot launch scans. Contact an admin for redteam or analyst access."
        />
      </PageStack>
    );
  }

  return (
    <PageStack>
      <PageHeader
        title="Red Team Console"
        description="Evaluate, scan, and red-team your models — continuous adversarial testing for safety and security."
        icon={<Swords className="h-5 w-5" />}
      />

      <MotionCard hover reveal className="red-team-hero-wrapper">
        <RedTeamConsoleHero
          isRunning={isRunning}
          completed={completed}
          canLaunch={canLaunch}
          onLaunch={handleLaunch}
          targetName={provider?.name ?? historySelection?.provider}
          targetModel={provider?.model ?? historySelection?.model}
          scanModeLabel={profileMeta.label}
          rounds={rounds}
          metrics={scanMetrics}
        />
      </MotionCard>

      <RedTeamQuickLinks
        campaignId={displayCampaignId}
        findingsCount={scanMetrics.findingsCount}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total scans"
          value={stats.total}
          subtitle="Archived evaluations"
          icon={Target}
          sparklineData={campaigns.slice(0, 8).map((c) => c.rounds_completed || 1)}
        />
        <StatCard label="Completed" value={stats.completed} subtitle="Finished runs" />
        <StatCard label="Avg attack score" value={stats.avgSuccess} subtitle="Across completed" />
      </div>

      <div className="red-team-workspace surface-panel overflow-hidden rounded-xl border border-border">
        <div className="grid lg:grid-cols-12 lg:items-start">
          <RedTeamEvaluationStudio
            campaignName={campaignName}
            onCampaignNameChange={setCampaignName}
            focusObjective={focusObjective}
            onFocusObjectiveChange={setFocusObjective}
            providers={providers}
            providersLoading={providersLoading}
            selectedProviderId={selectedProvider}
            onSelectProvider={handleProviderSelect}
            modelName={modelName}
            onModelNameChange={setModelName}
            baseUrl={baseUrl}
            onBaseUrlChange={setBaseUrl}
            showBaseUrl={provider?.type === "local" || selectedProvider === "custom"}
            attackProfiles={ATTACK_PROFILES}
            attackProfile={attackProfile}
            onAttackProfileChange={setAttackProfile}
            categoryLabels={CATEGORY_LABELS}
            profileAsi={profileAsi}
            rounds={rounds}
            onRoundsChange={setRounds}
            roundsEstimateMin={roundsEstimateMin}
            useLlmJudge={useLlmJudge}
            onUseLlmJudgeChange={setUseLlmJudge}
            isRunning={isRunning}
            canLaunch={canLaunch}
            onLaunch={handleLaunch}
            targetPreviewName={provider?.name}
            profileLabel={profileMeta.label}
          />

          <div className="console-panel min-h-0 border-b border-border lg:col-span-6 lg:border-b-0 xl:col-span-6">
            <div className="border-b border-border px-4 py-3">
              <p className="text-sm font-semibold tracking-tight">Run output</p>
              <p className="text-xs text-muted-foreground">
                Live adversarial session, orchestration logs, and aggregated scan results.
              </p>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                {historySelection?.name ?? (isRunning ? "Live scan" : "No scan selected")}
                {displayCampaignId ? ` · ${displayCampaignId}` : ""}
              </p>
            </div>

            <RedTeamScanSummary metrics={scanMetrics} visible={showScanSummary} />

            <RedTeamLiveHud
              running={isRunning}
              status={status}
              roundsCompleted={roundsCompleted}
              maxRounds={maxRounds || rounds}
              progressPct={progressPct}
              targetName={provider?.name ?? historySelection?.provider}
              scanModeLabel={profileMeta.label}
            />

            {isRunning && (
              <div className="border-b border-border px-4 py-3">
                <p className="section-label mb-2">Agent orchestration</p>
                <AgentStatusStrip agents={scanAgents} compact />
              </div>
            )}

            <Tabs
              value={outputTab}
              onValueChange={(v) => setOutputTab(v as OutputTab)}
              className="flex flex-1 flex-col"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 pt-2">
                <TabsList className="h-8">
                  <TabsTrigger value="theater" className="text-xs">Session</TabsTrigger>
                  <TabsTrigger value="console" className="text-xs">Console</TabsTrigger>
                  <TabsTrigger value="results" className="text-xs" disabled={!displaySummary}>
                    Results
                  </TabsTrigger>
                </TabsList>
                {transcriptTurns.length > 0 && outputTab === "theater" && (
                  <p className="text-[10px] text-muted-foreground">← → navigate rounds</p>
                )}
              </div>

              <TabsContent value="theater" className="mt-0 flex-1 space-y-4 p-4">
                <RedTeamRoundStrip
                  turns={transcriptTurns}
                  selectedRound={selectedRound}
                  onSelectRound={setSelectedRound}
                />
                <RedTeamTheater turn={activeTurn} loading={transcriptLoading} />
                <RedTeamCoverageGrid objectives={profileAsi} turns={transcriptTurns} />
                <div className="grid gap-4 lg:grid-cols-2">
                  <JudgeVerdictPanel turn={activeTurn} />
                  <PromoteToPlaybookPanel
                    turn={activeTurn}
                    findingId={
                      displayCampaignId && activeTurn
                        ? `campaign-${displayCampaignId}-r${activeTurn.roundNumber}`
                        : null
                    }
                    onPromoted={() => {
                      void refreshCampaigns();
                      void refreshPolicies();
                    }}
                  />
                </div>
              </TabsContent>

              <TabsContent
                value="console"
                className="mt-0 flex-1 data-[state=active]:flex data-[state=active]:flex-col"
              >
                <ScrollArea className="console-viewport flex-1">
                  <div className="space-y-0.5 p-4 font-mono text-[11px] leading-relaxed sm:text-xs">
                    {errorMessage && (
                      <p className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive">
                        {errorMessage}
                      </p>
                    )}
                    {logs.length === 0 ? (
                      <p className="py-16 text-center text-muted-foreground">
                        Orchestration logs appear when a scan runs.
                      </p>
                    ) : (
                      logs.map((line, idx) => (
                        <div key={`${idx}-${line.slice(0, 24)}`} className={logTone(line)}>
                          {line}
                        </div>
                      ))
                    )}
                    <div ref={consoleEndRef} />
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="results" className="mt-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">
                {displaySummary ? (
                  <>
                    <RedTeamVerdictBreakdown verdicts={scanMetrics.verdicts} />
                    <CampaignResults
                      summary={displaySummary}
                      campaignId={displayCampaignId}
                      featuredTurn={activeTurn}
                    />
                  </>
                ) : (
                  <p className="py-12 text-center text-sm text-muted-foreground">
                    Aggregated results appear when a scan completes.
                  </p>
                )}
              </TabsContent>
            </Tabs>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 text-muted-foreground"
                onClick={() => {
                  reset();
                  setHistorySelection(null);
                  setOutputTab("theater");
                  setSelectedRound(null);
                  setFocusObjective("");
                }}
                disabled={isRunning}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Clear
              </Button>
              <p className="text-[10px] text-muted-foreground">
                {templateCount} templates · ⌘/Ctrl+Enter to scan
              </p>
            </div>
          </div>

          <div className="space-y-0 lg:col-span-3">
            <CampaignHistory
              campaigns={campaigns}
              loading={campaignsLoading}
              selectedId={historySelection?.id ?? campaignId}
              activeRunId={isRunning ? campaignId : null}
              onSelect={handleHistorySelect}
              embedded
            />
            <div className="border-t border-border p-4">
              <RedTeamFindingsPanel
                turns={transcriptTurns}
                selectedRound={selectedRound}
                onSelectRound={(r) => {
                  setSelectedRound(r);
                  setOutputTab("theater");
                }}
              />
            </div>
            <div className="border-t border-border p-4">
              <RedTeamRiskProfile turns={transcriptTurns} />
            </div>
          </div>
        </div>
      </div>
    </PageStack>
  );
}
