"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Consistent demo-mode label so operators never confuse fixtures with live telemetry. */
export function SimulatedBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="secondary"
      className={cn("font-mono text-[10px] uppercase", className)}
      title="Demonstration data — ingest pipeline idle or offline. Not live production telemetry."
      aria-label="Simulated demo data"
    >
      Simulated demo
    </Badge>
  );
}
