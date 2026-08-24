"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ForensicsView {
  forensic_summary?: string;
  privilege_escalation_detected?: boolean;
  recon_duration_turns?: number;
  goal_drift_distance?: number;
  total_events?: number;
}

export function ReplayForensicsPanel({
  data,
  className,
}: {
  data: Record<string, unknown>;
  className?: string;
}) {
  const f = data as ForensicsView;

  return (
    <div className={cn("animate-panel-in rounded-lg border border-border bg-card p-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Forensic analysis</h3>
        {f.privilege_escalation_detected && (
          <Badge variant="critical" className="text-[10px]">Privilege escalation</Badge>
        )}
      </div>
      {f.forensic_summary && (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.forensic_summary}</p>
      )}
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Events</dt>
          <dd className="mt-1 font-mono text-lg font-semibold tabular-nums">{f.total_events ?? "—"}</dd>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Recon turns</dt>
          <dd className="mt-1 font-mono text-lg font-semibold tabular-nums">
            {f.recon_duration_turns ?? "—"}
          </dd>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Goal drift</dt>
          <dd className="mt-1 font-mono text-lg font-semibold tabular-nums">
            {Number.isFinite(f.goal_drift_distance) ? f.goal_drift_distance!.toFixed(2) : "—"}
          </dd>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Escalation</dt>
          <dd className="mt-1 text-sm font-medium">
            {f.privilege_escalation_detected ? "Detected" : "None"}
          </dd>
        </div>
      </dl>
    </div>
  );
}
