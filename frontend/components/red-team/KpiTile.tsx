"use client";

import { cn } from "@/lib/utils";

export function KpiTile({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "neutral" | "critical" | "success" | "warning";
}) {
  return (
    <div className="rounded-md border border-border px-3 py-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 font-mono text-2xl font-semibold tabular-nums",
          tone === "critical" && "text-[hsl(var(--severity-critical))]",
          tone === "success" && "text-[hsl(var(--severity-low))]",
          tone === "warning" && "text-[hsl(var(--severity-medium))]",
          tone === "neutral" && "text-foreground"
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
