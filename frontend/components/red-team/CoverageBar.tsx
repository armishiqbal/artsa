"use client";

import { cn } from "@/lib/utils";

export function CoverageBar({
  label,
  pct,
  className,
}: {
  label: string;
  pct: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex justify-between text-[12px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono tabular-nums">{clamped}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-sm bg-muted">
        <div className="h-full bg-foreground/70" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}
