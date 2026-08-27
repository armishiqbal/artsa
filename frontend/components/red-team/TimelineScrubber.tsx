"use client";

import { cn } from "@/lib/utils";

/** Scrubber-lite for ended / paused theater replay. */
export function TimelineScrubber({
  total,
  cursor,
  playing,
  onSeek,
  onPlay,
  className,
}: {
  total: number;
  cursor: number;
  playing: boolean;
  onSeek: (index: number) => void;
  onPlay: (playing: boolean) => void;
  className?: string;
}) {
  const max = Math.max(0, total - 1);
  return (
    <div className={cn("flex min-w-[180px] flex-1 items-center gap-2", className)}>
      <button
        type="button"
        onClick={() => onPlay(!playing)}
        className="rounded-sm border border-border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
        aria-label={playing ? "Pause scrubber" : "Play scrubber"}
      >
        {playing ? "Pause" : "Play"}
      </button>
      <input
        type="range"
        min={0}
        max={max || 0}
        value={Math.min(cursor, max)}
        onChange={(e) => onSeek(Number(e.target.value))}
        className="h-1.5 w-full accent-foreground"
        aria-label="Round scrubber"
        disabled={total === 0}
      />
      <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
        {total === 0 ? "0/0" : `${cursor + 1}/${total}`}
      </span>
    </div>
  );
}
