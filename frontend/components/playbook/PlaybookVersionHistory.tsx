"use client";

import { GitCommitHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { PlaybookVersionEntry } from "@/lib/context/AppDataProvider";

const TRIGGER_LABELS: Record<string, string> = {
  initial: "Initial snapshot",
  manual_update: "Manual update",
  rule_add: "Rule added",
  finding_promote: "Finding promoted",
};

interface PlaybookVersionHistoryProps {
  versions: PlaybookVersionEntry[];
  loading?: boolean;
  currentVersion?: number;
}

export function PlaybookVersionHistory({
  versions,
  loading,
  currentVersion,
}: PlaybookVersionHistoryProps) {
  if (loading) {
    return <Skeleton className="h-48 w-full rounded-xl" />;
  }

  if (!versions.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No version history yet. Adding or promoting a rule creates the first playbook snapshot.
      </p>
    );
  }

  return (
    <ol className="relative space-y-4 border-l border-border pl-4">
      {versions.map((entry) => (
        <li key={entry.version} className="relative">
          <span className="absolute -left-[1.35rem] top-1 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card">
            <GitCommitHorizontal className="h-3 w-3 text-muted-foreground" aria-hidden />
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="meta-badge font-mono">
              v{entry.version}
              {currentVersion === entry.version ? " · current" : ""}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {TRIGGER_LABELS[entry.trigger] ?? entry.trigger}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">
              {entry.rule_count} rule{entry.rule_count === 1 ? "" : "s"}
            </span>
          </div>
          {entry.note && <p className="mt-1 text-xs text-foreground">{entry.note}</p>}
          {entry.finding_id && (
            <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
              Finding · {entry.finding_id}
            </p>
          )}
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {entry.created_at
              ? new Date(entry.created_at).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"}
          </p>
        </li>
      ))}
    </ol>
  );
}
