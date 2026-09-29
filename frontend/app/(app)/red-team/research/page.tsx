"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useCampaigns } from "@/lib/hooks/useCampaigns";
import { useThreatResearch } from "@/lib/hooks/useThreatResearch";
import { parseTopFindings } from "@/lib/campaignTranscript";
import { classifyFindingFamily, deriveRedTeamOverview } from "@/lib/redTeamOverview";
import { ThreatSyncModal } from "@/components/research/ThreatSyncModal";
import { FrameworkExplorer } from "@/components/research/FrameworkExplorer";
import { CapabilityFilterSimulator } from "@/components/research/CapabilityFilterSimulator";
import { AttackLibraryPromotionBar } from "@/components/research/AttackLibraryPromotionBar";
import type { CuratePromoteResult, TargetSurfaceConfig } from "@/lib/types/research";
import {
  ShieldAlert,
  Compass,
  Layers,
  FlaskConical,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ResearchTab = "frameworks" | "simulator" | "hypotheses";

export default function ResearchModePage() {
  const { campaigns, loading: campaignsLoading } = useCampaigns();
  const overview = useMemo(() => deriveRedTeamOverview(campaigns), [campaigns]);

  const {
    threats,
    metrics,
    loading: threatsLoading,
    syncing,
    simulating,
    promoting,
    searchQuery,
    setSearchQuery,
    selectedSource,
    setSelectedSource,
    selectedCategory,
    setSelectedCategory,
    curateResult,
    syncLiveFeeds,
    simulateCurator,
    promoteThreats,
  } = useThreatResearch();

  const [activeTab, setActiveTab] = useState<ResearchTab>("frameworks");
  const [selectedThreatIds, setSelectedThreatIds] = useState<Set<string>>(new Set());
  const [promoteResult, setPromoteResult] = useState<CuratePromoteResult | null>(null);

  // Experiment hypothesis framing
  const focus = useMemo(() => {
    const running = campaigns.find((c) => {
      const s = String(c.status).toUpperCase();
      return s === "RUNNING" || s === "PENDING";
    });
    const completed = campaigns.find((c) => String(c.status).toUpperCase() === "COMPLETED");
    return running ?? completed ?? campaigns[0] ?? null;
  }, [campaigns]);

  const findings = useMemo(() => parseTopFindings(focus?.summary ?? null), [focus]);
  const family = findings[0]
    ? classifyFindingFamily(`${findings[0].attackName} ${findings[0].category}`)
    : overview.coverage.find((c) => c.tested > 0)?.family ?? "—";

  const defaultHypothesis = focus
    ? `Campaign “${focus.name}” (${focus.provider}/${focus.model}) — ${findings.length} findings, ${focus.rounds_completed}/${focus.total_rounds} rounds. Hypothesis: defenses fail on ${family}.`
    : "Connect a provider and run a campaign to frame a live experiment.";

  const [hypothesis, setHypothesis] = useState(defaultHypothesis);

  useEffect(() => {
    setHypothesis(defaultHypothesis);
  }, [defaultHypothesis]);

  // Threat selection toggles
  const handleToggleThreatSelect = (id: string) => {
    setSelectedThreatIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllVisible = (ids: string[]) => {
    setSelectedThreatIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedThreatIds(new Set());
  };

  // Promotion handling
  const handlePromoteSelected = async (surface?: TargetSurfaceConfig) => {
    const ids = Array.from(selectedThreatIds);
    const res = await promoteThreats(ids.length > 0 ? ids : undefined, surface);
    if (res) {
      setPromoteResult(res);
    }
  };

  const handlePromoteRetained = async (surface: TargetSurfaceConfig) => {
    if (!curateResult || curateResult.retained.length === 0) return;
    const ids = curateResult.retained.map((r) => r.record.framework_id || r.record.id);
    const res = await promoteThreats(ids, surface);
    if (res) {
      setPromoteResult(res);
    }
  };

  // Build targeted campaign launch URL
  const campaignLaunchUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("source", "research");

    const ids = Array.from(selectedThreatIds);
    if (ids.length > 0) {
      params.set("threat_ids", ids.slice(0, 10).join(","));
    } else if (curateResult && curateResult.retained.length > 0) {
      params.set("threat_ids", curateResult.retained.map((r) => r.record.framework_id || r.record.id).slice(0, 10).join(","));
    }

    if (selectedCategory) {
      params.set("sets", selectedCategory);
    }

    params.set("name", "Curated Threat Assessment · Research Feeds");
    return `/red-team/campaigns/new?${params.toString()}`;
  }, [selectedThreatIds, curateResult, selectedCategory]);

  const fields = focus
    ? ([
        ["Campaign ID", focus.id],
        ["Status", String(focus.status).toUpperCase()],
        ["Attack family (sample)", family],
        ["Model", `${focus.provider} / ${focus.model}`],
        ["Trials (rounds)", `${focus.rounds_completed} / ${focus.total_rounds}`],
        ["Detect rate", overview.detectPct != null ? `${overview.detectPct}%` : "—"],
      ] as const)
    : null;

  return (
    <div className="space-y-6 pb-20">
      {/* Top Header with Live Sync Trigger */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-foreground">Threat Intelligence & Research Hub</h2>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-mono font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
              Live Intel Ingestion
            </span>
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Ingest live vulnerability disclosures (NVD CVEs) and adversarial techniques (MITRE ATLAS, OWASP Agentic Top 10, NIST AI RMF).
            Simulate Curator Agent capability filtering and promote attack seeds into the AttackLibrary.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <ThreatSyncModal onSync={syncLiveFeeds} syncing={syncing} />

          <Button size="sm" variant="outline" asChild className="font-mono text-[12px]">
            <Link href="/red-team/campaigns/new">New Campaign</Link>
          </Button>
        </div>
      </div>

      {/* Framework Metrics Summary Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Total Threats</p>
          <p className="mt-1 font-mono text-xl font-bold text-foreground">
            {metrics?.total_threats ?? threats.length}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">OWASP ASI (Top 10)</p>
          <p className="mt-1 font-mono text-xl font-bold text-indigo-500">
            {metrics?.sources["OWASP_ASI"] ?? 10}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">MITRE ATLAS</p>
          <p className="mt-1 font-mono text-xl font-bold text-amber-500">
            {metrics?.sources["MITRE_ATLAS"] ?? 5}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">NIST AI RMF</p>
          <p className="mt-1 font-mono text-xl font-bold text-emerald-500">
            {metrics?.sources["NIST_AI_RMF"] ?? 9}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">NVD Live CVEs</p>
          <p className="mt-1 font-mono text-xl font-bold text-rose-500">
            {metrics?.sources["NVD_LIVE"] ?? 3}
          </p>
        </div>
      </div>

      {/* View Mode Navigation Tabs */}
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab("frameworks")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2.5 text-[13px] font-mono font-medium transition-colors cursor-pointer",
            activeTab === "frameworks"
              ? "border-primary text-foreground font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Compass className="h-4 w-4" />
          <span>Framework Matrix Explorer</span>
          <span className="rounded-full bg-muted px-2 py-0.2 text-[10px]">{threats.length}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("simulator")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2.5 text-[13px] font-mono font-medium transition-colors cursor-pointer",
            activeTab === "simulator"
              ? "border-primary text-foreground font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Layers className="h-4 w-4" />
          <span>Curator Capability Filter</span>
          {curateResult && (
            <span className="rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2 py-0.2 text-[10px] font-bold">
              {curateResult.retained_count} Retained
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("hypotheses")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2.5 text-[13px] font-mono font-medium transition-colors cursor-pointer",
            activeTab === "hypotheses"
              ? "border-primary text-foreground font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <FlaskConical className="h-4 w-4" />
          <span>Experiment Framing</span>
        </button>
      </div>

      {/* Main Tab Content */}
      {activeTab === "frameworks" && (
        <FrameworkExplorer
          threats={threats}
          loading={threatsLoading}
          selectedSource={selectedSource}
          onSelectSource={setSelectedSource}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedThreatIds={selectedThreatIds}
          onToggleThreatSelect={handleToggleThreatSelect}
          onSelectAllVisible={handleSelectAllVisible}
          onClearSelection={handleClearSelection}
        />
      )}

      {activeTab === "simulator" && (
        <CapabilityFilterSimulator
          onSimulate={simulateCurator}
          simulating={simulating}
          curateResult={curateResult}
          onPromoteRetained={handlePromoteRetained}
          promoting={promoting}
        />
      )}

      {activeTab === "hypotheses" && (
        <div className="space-y-4">
          <p className="text-[13px] text-muted-foreground">
            Formulate experiment hypotheses from running and completed campaigns to focus the Curator Agent on observed vulnerability patterns.
          </p>

          {campaignsLoading && !focus ? (
            <p className="text-[13px] text-muted-foreground font-mono">Loading campaign metadata…</p>
          ) : !fields ? (
            <div className="rounded-md border border-dashed border-border px-4 py-8 text-center text-[13px] text-muted-foreground font-mono">
              No campaigns active yet. Launch one to populate experiment telemetry.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {fields.map(([k, v]) => (
                <div key={k} className="rounded-md border border-border bg-card px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-mono">{k}</p>
                  <p className="mt-1 break-all font-mono text-[12px]">{v}</p>
                </div>
              ))}
              <label className="space-y-1 text-[12px] sm:col-span-2">
                <span className="text-muted-foreground font-mono">Experiment Hypothesis</span>
                <textarea
                  rows={3}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] font-mono leading-relaxed"
                  value={hypothesis}
                  onChange={(e) => setHypothesis(e.target.value)}
                />
              </label>
            </div>
          )}

          {focus && (
            <Button size="sm" variant="outline" asChild className="font-mono text-[12px]">
              <Link href={`/red-team/monitor/${focus.id}`}>Open Campaign Theater</Link>
            </Button>
          )}
        </div>
      )}

      {/* Floating Promotion & Campaign Launch Bar */}
      <AttackLibraryPromotionBar
        selectedCount={selectedThreatIds.size}
        onPromote={() => handlePromoteSelected()}
        promoting={promoting}
        promoteResult={promoteResult}
        campaignLaunchUrl={campaignLaunchUrl}
        onClearSelection={handleClearSelection}
      />
    </div>
  );
}
