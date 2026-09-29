"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sparkles, Play, BookOpen, CheckCircle2, ArrowRight } from "lucide-react";
import type { CuratePromoteResult } from "@/lib/types/research";

interface AttackLibraryPromotionBarProps {
  selectedCount: number;
  onPromote: () => void;
  promoting: boolean;
  promoteResult: CuratePromoteResult | null;
  campaignLaunchUrl: string;
  onClearSelection: () => void;
}

export function AttackLibraryPromotionBar({
  selectedCount,
  onPromote,
  promoting,
  promoteResult,
  campaignLaunchUrl,
  onClearSelection,
}: AttackLibraryPromotionBarProps) {
  if (selectedCount === 0 && !promoteResult) return null;

  return (
    <div className="sticky bottom-4 z-40 rounded-xl border border-border/80 bg-background/95 p-3.5 shadow-2xl backdrop-blur-md dark:border-white/10 dark:bg-[#0c1017]/95">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            <Sparkles className="h-4 w-4" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[13px] font-bold text-foreground">
                {selectedCount} Threat Vector{selectedCount !== 1 ? "s" : ""} Selected
              </span>
              {promoteResult && (
                <span className="flex items-center gap-1 font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                  <CheckCircle2 className="h-3 w-3" />
                  {promoteResult.promoted_count} Seeds Promoted
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground font-mono">
              Promote findings into AttackLibrary templates or launch a focused adversarial assessment.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
              className="text-[11px] font-mono text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Clear Selection
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={onPromote}
            disabled={promoting || selectedCount === 0}
            className="gap-1.5 border-emerald-500/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 font-mono text-[12px] cursor-pointer"
          >
            <Sparkles className={`h-3.5 w-3.5 ${promoting ? "animate-spin" : ""}`} />
            <span>{promoting ? "Promoting Seeds…" : "Promote to AttackLibrary"}</span>
          </Button>

          {promoteResult && (
            <Button variant="ghost" size="sm" asChild className="font-mono text-[11px] text-muted-foreground hover:text-foreground gap-1">
              <Link href="/red-team/library">
                <BookOpen className="h-3.5 w-3.5" />
                <span>View Library</span>
              </Link>
            </Button>
          )}

          <Button size="sm" asChild className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-mono text-[12px] cursor-pointer">
            <Link href={campaignLaunchUrl}>
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Launch Targeted Campaign</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
