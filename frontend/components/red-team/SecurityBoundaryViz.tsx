"use client";

import { cn } from "@/lib/utils";
import { OutcomeBadge } from "@/components/red-team/OutcomeBadge";

/** Signature viz: Attack → Agent → Detection → Boundary → Data outcome. */
export function SecurityBoundaryViz({
  detectionOk,
  boundaryOk,
  dataSafe,
  className,
}: {
  detectionOk: boolean;
  boundaryOk: boolean;
  dataSafe: boolean;
  className?: string;
}) {
  return (
    <div className={cn("rounded-md border border-border p-4", className)}>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Security boundary
      </h3>
      <p className="mt-1 text-[12px] text-muted-foreground">
        Detection failing is not the same as data leaking.
      </p>

      <div className="mt-4 space-y-3 text-[12px]">
        <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
          <p className="font-medium">AI Agent</p>
          <p className="text-muted-foreground">Detection layer</p>
          <div className="mt-2">
            <OutcomeBadge outcome={detectionOk ? "blocked" : "detection_failed"} />
          </div>
        </div>

        <div className="flex justify-center text-muted-foreground" aria-hidden>
          ↓
        </div>

        <div className="rounded-md border border-border px-3 py-2">
          <p className="font-medium">Security boundary</p>
          <ul className="mt-1 list-inside list-disc text-muted-foreground">
            <li>Authorization</li>
            <li>Data isolation</li>
            <li>Tool permissions</li>
          </ul>
          <div className="mt-2">
            <OutcomeBadge outcome={boundaryOk ? "safe" : "risk"} />
          </div>
        </div>

        <div className="flex justify-center text-muted-foreground" aria-hidden>
          ↓
        </div>

        <div className="rounded-md border border-border px-3 py-2">
          <p className="font-medium">Data outcome</p>
          <div className="mt-2">
            <OutcomeBadge outcome={dataSafe ? "safe" : "data_leaked"} />
          </div>
        </div>
      </div>
    </div>
  );
}
