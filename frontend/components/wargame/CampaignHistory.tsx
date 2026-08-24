"use client";

import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { CampaignListItem } from "@/lib/hooks/useCampaigns";
import { cn } from "@/lib/utils";

function statusVariant(status: string): "success" | "destructive" | "info" | "secondary" {
  const s = status.toUpperCase();
  if (s === "COMPLETED") return "success";
  if (s === "FAILED") return "destructive";
  if (s === "RUNNING") return "info";
  return "secondary";
}

export function CampaignHistory({
  campaigns,
  loading,
  selectedId,
  activeRunId,
  onSelect,
  embedded = false,
}: {
  campaigns: CampaignListItem[];
  loading: boolean;
  selectedId: string | null;
  activeRunId: string | null;
  onSelect: (campaign: CampaignListItem) => void;
  embedded?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[280px] flex-col overflow-hidden",
        !embedded && "surface-panel lg:min-h-0"
      )}
    >
      <div className="dashboard-card-header border-b border-border px-4 py-3">
        <p className="text-sm font-semibold tracking-tight">Scan history</p>
        <p className="text-[11px] text-muted-foreground">{campaigns.length} evaluations archived</p>
      </div>
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="space-y-2 p-3">
            {[1, 2, 4, 5].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <p className="p-6 text-center text-xs text-muted-foreground">
            No scans yet. Configure a target and launch your first evaluation.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {campaigns.map((c) => {
              const isSelected = selectedId === c.id;
              const isLive = activeRunId === c.id;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(c)}
                    className={cn(
                      "interactive-row flex w-full flex-col gap-1 border-l-2 px-4 py-3 text-left",
                      isSelected ? "border-l-foreground bg-muted/60" : "border-l-transparent"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <Badge variant={statusVariant(c.status)} className="meta-badge shrink-0">
                        {isLive ? (
                          <span className="flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Live
                          </span>
                        ) : (
                          c.status
                        )}
                      </Badge>
                    </div>
                    <p className="truncate font-mono text-[10px] text-muted-foreground">
                      {c.provider} · {c.model}
                    </p>
                    <p className="font-mono text-[10px] text-muted-foreground tabular-nums">
                      {c.rounds_completed}/{c.total_rounds} rounds
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>
    </div>
  );
}
