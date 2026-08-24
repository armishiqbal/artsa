"use client";

import { Crosshair, Clock, Sparkles, Play, Loader2 } from "lucide-react";
import Link from "next/link";
import { PresetCard } from "@/components/shared/PresetCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionLabel } from "@/components/shared/SectionLabel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { AsiCategory } from "@/lib/asiCategories";
import type { LucideIcon } from "lucide-react";

export interface AttackProfileOption {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  categories: readonly string[];
  mutations: boolean;
  lakeraBadge?: string;
}

interface ProviderRow {
  id: string;
  name: string;
  model: string;
  configured?: boolean;
  type?: string;
}

interface RedTeamEvaluationStudioProps {
  focusObjective: string;
  onFocusObjectiveChange: (v: string) => void;
  campaignName: string;
  onCampaignNameChange: (v: string) => void;
  providers: ProviderRow[];
  providersLoading: boolean;
  selectedProviderId: string | null;
  onSelectProvider: (id: string) => void;
  modelName: string;
  onModelNameChange: (v: string) => void;
  baseUrl: string;
  onBaseUrlChange: (v: string) => void;
  showBaseUrl: boolean;
  attackProfiles: readonly AttackProfileOption[];
  attackProfile: string;
  onAttackProfileChange: (id: string) => void;
  categoryLabels: Record<string, string>;
  profileAsi: AsiCategory[];
  rounds: number;
  onRoundsChange: (n: number) => void;
  roundsEstimateMin: number;
  useLlmJudge: boolean;
  onUseLlmJudgeChange: (v: boolean) => void;
  isRunning: boolean;
  canLaunch: boolean;
  onLaunch: () => void;
  targetPreviewName?: string | null;
  profileLabel?: string;
}

/** Lakera Evaluation Studio — target + scan configuration rail. */
export function RedTeamEvaluationStudio({
  campaignName,
  onCampaignNameChange,
  focusObjective,
  onFocusObjectiveChange,
  providers,
  providersLoading,
  selectedProviderId,
  onSelectProvider,
  modelName,
  onModelNameChange,
  baseUrl,
  onBaseUrlChange,
  showBaseUrl,
  attackProfiles,
  attackProfile,
  onAttackProfileChange,
  categoryLabels,
  profileAsi,
  rounds,
  onRoundsChange,
  roundsEstimateMin,
  useLlmJudge,
  onUseLlmJudgeChange,
  isRunning,
  canLaunch,
  onLaunch,
  targetPreviewName,
  profileLabel,
}: RedTeamEvaluationStudioProps) {
  return (
    <aside className="space-y-5 border-b border-border p-4 sm:p-5 lg:col-span-3 lg:border-b-0 lg:border-r xl:col-span-3">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Crosshair className="h-4 w-4 text-muted-foreground" aria-hidden />
          <h2 className="text-sm font-semibold tracking-tight">Evaluation Studio</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Select the model or agent under test and define scan depth.
        </p>
      </div>

      <section>
        <SectionLabel>Scan label</SectionLabel>
        <Input
          value={campaignName}
          onChange={(e) => onCampaignNameChange(e.target.value)}
          placeholder={targetPreviewName ? `Red Team: ${targetPreviewName}` : "Optional evaluation name"}
          className="mt-2 text-sm"
          disabled={isRunning}
        />
      </section>

      <section className="border-t border-border pt-4">
        <SectionLabel>Focus objective</SectionLabel>
        <textarea
          value={focusObjective}
          onChange={(e) => onFocusObjectiveChange(e.target.value)}
          placeholder="What should this scan try to achieve? e.g. Extract system prompt via indirect injection"
          disabled={isRunning}
          rows={3}
          className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-xs leading-relaxed text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        />
        <p className="mt-1 text-[10px] text-muted-foreground">
          Lakera-style attack intent — scopes judge evaluation and labels the scan.
        </p>
      </section>

      <section className="border-t border-border pt-4">
        <SectionLabel>Target</SectionLabel>
        {providersLoading ? (
          <div className="mt-3 space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : providers.length === 0 ? (
          <EmptyState
            icon={Crosshair}
            title="No targets"
            description="Add an LLM provider to scan."
            action={
              <Button asChild size="sm">
                <Link href="/admin/providers">Configure providers</Link>
              </Button>
            }
            className="mt-3 border-0 bg-transparent p-2 shadow-none"
          />
        ) : (
          <div className="selection-list mt-3" role="listbox" aria-label="Targets">
            {providers.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelectProvider(p.id)}
                aria-current={selectedProviderId === p.id ? "true" : undefined}
                data-selected={selectedProviderId === p.id ? "true" : "false"}
                className={cn(
                  "selection-list-item",
                  !p.configured && p.type !== "local" && "opacity-70"
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="truncate font-mono text-[11px] text-muted-foreground">{p.model}</p>
                </div>
                <Badge
                  variant={p.configured ? "success" : "secondary"}
                  className="meta-badge shrink-0"
                >
                  {p.configured ? "Ready" : "No key"}
                </Badge>
              </button>
            ))}
          </div>
        )}
      </section>

      {selectedProviderId && (
        <section className="animate-panel-in space-y-3 border-t border-border pt-4">
          <div>
            <label htmlFor="rt-model" className="text-xs font-medium text-muted-foreground">
              Model endpoint
            </label>
            <Input
              id="rt-model"
              value={modelName}
              onChange={(e) => onModelNameChange(e.target.value)}
              className="mt-1.5 font-mono text-xs"
              disabled={isRunning}
            />
          </div>
          {showBaseUrl && (
            <div>
              <label htmlFor="rt-base-url" className="text-xs font-medium text-muted-foreground">
                Base URL
              </label>
              <Input
                id="rt-base-url"
                value={baseUrl}
                onChange={(e) => onBaseUrlChange(e.target.value)}
                placeholder="http://localhost:11434/v1"
                className="mt-1.5 font-mono text-xs"
                disabled={isRunning}
              />
            </div>
          )}
        </section>
      )}

      <section className="border-t border-border pt-4">
        <SectionLabel>Scan type</SectionLabel>
        <div className="mt-3 space-y-2">
          {attackProfiles.map((profile) => (
            <PresetCard
              key={profile.id}
              id={profile.id}
              label={profile.label}
              description={profile.description}
              icon={profile.icon}
              badge={profile.lakeraBadge}
              active={attackProfile === profile.id}
              onClick={() => !isRunning && onAttackProfileChange(profile.id)}
              className={cn(isRunning && "pointer-events-none opacity-60")}
            />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {attackProfiles
            .find((p) => p.id === attackProfile)
            ?.categories.map((code) => (
              <Badge key={code} variant="secondary" className="meta-badge font-normal">
                {categoryLabels[code] ?? code}
              </Badge>
            ))}
        </div>
        {profileAsi.length > 0 && (
          <div className="mt-3">
            <SectionLabel>Objectives</SectionLabel>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {profileAsi.map((asi) => (
                <Badge key={asi.code} variant="outline" className="meta-badge font-mono text-[10px]">
                  {asi.code}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="border-t border-border pt-4">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="rt-rounds" className="section-label">Session depth</label>
          <span className="flex items-center gap-1 font-mono text-sm tabular-nums">
            <Clock className="h-3 w-3 text-muted-foreground" aria-hidden />
            {rounds}
          </span>
        </div>
        <input
          id="rt-rounds"
          type="range"
          min={1}
          max={20}
          value={rounds}
          onChange={(e) => onRoundsChange(Number(e.target.value))}
          disabled={isRunning}
          className="mt-3 w-full accent-foreground"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">Est. ~{roundsEstimateMin} min</p>
      </section>

      <section className="border-t border-border pt-4">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={useLlmJudge}
            onChange={(e) => onUseLlmJudgeChange(e.target.checked)}
            disabled={isRunning}
            className="rounded border-border"
          />
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          LLM judge (higher accuracy, slower)
        </label>
      </section>

      {selectedProviderId && (
        <section className="preview-panel border-t border-border pt-4">
          <SectionLabel>Ready to scan</SectionLabel>
          <dl className="mt-2 space-y-1 font-mono text-[11px]">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Target</dt>
              <dd className="truncate text-foreground">{targetPreviewName}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Scan</dt>
              <dd>{profileLabel}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Depth</dt>
              <dd>{rounds} turns</dd>
            </div>
          </dl>
        </section>
      )}

      <div className="border-t border-border pt-4">
        <Button onClick={onLaunch} disabled={!canLaunch} className="w-full gap-2">
          {isRunning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Scanning…
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Start scan
            </>
          )}
        </Button>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">⌘/Ctrl + Enter</p>
      </div>
    </aside>
  );
}
