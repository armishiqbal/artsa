"use client";

import { cn } from "@/lib/utils";
import type { AssessmentCategoryRow } from "@/lib/assessmentResults";

interface AssessmentCategoryBarsProps {
  rows: AssessmentCategoryRow[];
  className?: string;
}

export function AssessmentCategoryBars({ rows, className }: AssessmentCategoryBarsProps) {
  if (!rows.length) {
    return (
      <p className="py-10 text-center text-[13px] text-[#7c7c7c]">
        No category results yet.
      </p>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {rows.map((row) => (
        <div key={row.lens} className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <span className="text-[13px] font-medium text-white">{row.lens}</span>
              <span className="ml-2 font-mono text-[10px] text-[#7c7c7c]">
                {row.harmful}/{row.total} harmful
              </span>
            </div>
            <span className="font-mono text-[13px] tabular-nums text-[#a7a7a7]">
              {row.riskScore}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#1e1e1e]">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                row.riskScore > 75
                  ? "bg-[hsl(var(--severity-critical))]"
                  : row.riskScore > 50
                    ? "bg-[hsl(var(--severity-high))]"
                    : row.riskScore > 25
                      ? "bg-[hsl(var(--severity-medium))]"
                      : "bg-[#4ade80]"
              )}
              style={{ width: `${Math.min(100, row.riskScore)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
