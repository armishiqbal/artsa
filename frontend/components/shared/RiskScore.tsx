"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { riskScoreBadgeVariant } from "@/lib/severity";

interface RiskScoreProps {
  score: number;
  className?: string;
}

export function RiskScore({ score, className }: RiskScoreProps) {
  const variant = riskScoreBadgeVariant(score);
  const value = Number.isFinite(score) ? score.toFixed(1) : "—";

  return (
    <Badge variant={variant} className={cn("gap-1 font-mono tabular-nums", className)}>
      <span className="font-semibold">{value}</span>
      <span className="text-[10px] opacity-70">/100</span>
    </Badge>
  );
}
