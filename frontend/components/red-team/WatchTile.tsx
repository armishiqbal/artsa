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
        "block rounded-md border border-border p-3 transition-colors hover:bg-muted/30",
        live && "border-[#6798ff]/35 bg-[#6798ff]/5"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-[13px] font-medium">{name}</p>
        {live ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[#6798ff]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inset-0 animate-ping rounded-full bg-[#6798ff]/50" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-[#6798ff]" />
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
