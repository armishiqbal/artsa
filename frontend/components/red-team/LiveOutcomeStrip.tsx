"use client";

import { OutcomeBadge, type SecurityOutcome } from "@/components/red-team/OutcomeBadge";
import { cn } from "@/lib/utils";

/** Always-visible Detection · Prevention · Leak (v2 vocabulary). */
export function LiveOutcomeStrip({
  detection,
  prevention,
  leak,
  className,
}: {
  detection: SecurityOutcome | string;
  prevention: SecurityOutcome | string;
  leak: SecurityOutcome | string;
  className?: string;
}) {
  const cells: { label: string; kind: "detection" | "prevention" | "leak"; value: string; hint: string }[] =
    [
      {
        label: "Detection",
        kind: "detection",
        value: String(detection),
        hint: "Did we see the attack?",
      },
      {
        label: "Prevention",
        kind: "prevention",
        value: String(prevention),
        hint: "Did policy stop it?",
      },
      {
        label: "Data leak",
        kind: "leak",
        value: String(leak),
        hint: "Did sensitive data leave?",
      },
    ];

  return (
    <div
      className={cn(
        "grid gap-2 rounded-md border border-border bg-card/30 p-2 sm:grid-cols-3",
        className
      )}
      role="group"
      aria-label="Security outcomes"
    >
      {cells.map((c) => (
        <div key={c.label} className="rounded-sm border border-border/80 px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            {c.label}
          </p>
          <div className="mt-1.5">
            <OutcomeBadge kind={c.kind} value={c.value} size="md" />
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">{c.hint}</p>
        </div>
      ))}
    </div>
  );
}
