"use client";

import Link from "next/link";
import { OutcomeBadge } from "@/components/red-team/OutcomeBadge";
import { cn } from "@/lib/utils";

export function WatchTile({
  campaignId,
  name,
  status,
  roundsCompleted,
  totalRounds,
  live,
}: {
  campaignId: string;
  name: string;
  status: string;
  roundsCompleted: number;
  totalRounds: number;
  live?: boolean;
}) {
  const s = status.toUpperCase();
  return (
    <Link
      href={`/red-team/monitor/${campaignId}`}
      className={cn(
        "block rounded-md border border-neutral-800 bg-[#0e0e0e] p-3 transition-colors hover:border-neutral-700 hover:bg-[#121212]",
        live && "border-emerald-500/35 bg-emerald-950/20"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-[13px] font-medium text-white">{name}</p>
        {live ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/50" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            Live
          </span>
        ) : (
          <OutcomeBadge
            value={
              s === "COMPLETED" ? "pass" : s === "FAILED" || s === "ERROR" ? "fail" : "risk"
            }
          />
        )}
      </div>
      <p className="mt-2 font-mono text-[11px] text-muted-foreground">
        {s} · {roundsCompleted}/{totalRounds || "?"}
      </p>
    </Link>
  );
}
