"use client";

import type { TranscriptTurn } from "@/lib/campaignTranscript";
import { cn } from "@/lib/utils";

/** Forensic tape for the selected round — data / telemetry monitor. */
export function LiveTelemetryTape({
  turn,
  className,
}: {
  turn: TranscriptTurn | null;
  className?: string;
}) {
  if (!turn) {
    return (
      <div className={cn("rounded-md border border-border px-3 py-6 text-center text-[13px] text-muted-foreground", className)}>
        Telemetry appears when a round is selected.
      </div>
    );
  }

  const events = [
    { t: "T+0", label: "Attack received", detail: turn.attackName },
    {
      t: "T+1",
      label: turn.targetError ? "Target error" : "Model responded",
      detail: turn.targetError ? turn.errorDetail || "error" : "response captured",
    },
    {
      t: "T+1",
      label: "Category / tool path",
      detail: turn.category || "n/a",
    },
    {
      t: "T+2",
      label: turn.blocked ? "Response blocked" : "Detection evaluated",
      detail: turn.blockedBy || turn.verdict,
    },
    {
      t: "T+2",
      label: "Boundary decision",
      detail:
        turn.attackSuccessScore >= 0.7
          ? "Attack pressure high — review data path"
          : "Boundary hold / low success score",
    },
  ];

  return (
    <div className={cn("rounded-md border border-border p-3", className)}>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Data monitor
      </h3>
      <ul className="mt-3 space-y-2">
        {events.map((e, i) => (
          <li key={`${e.t}-${e.label}-${i}`} className="flex gap-3 text-[12px]">
            <span className="w-10 shrink-0 font-mono text-[11px] text-muted-foreground">{e.t}</span>
            <div className="min-w-0">
              <p className="font-medium text-foreground">{e.label}</p>
              <p className="truncate text-muted-foreground">{e.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
