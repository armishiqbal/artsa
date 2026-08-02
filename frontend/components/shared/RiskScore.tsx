"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface RiskScoreProps {
  score: number;
  className?: string;
}

export function RiskScore({ score, className }: RiskScoreProps) {
  const variant =
    score >= 80 ? "critical" : score >= 50 ? "warning" : "success";

  return (
    <Badge variant={variant} className={cn("gap-1 font-mono tabular-nums", className)}>
      <span className="font-semibold">{score.toFixed(1)}</span>
      <span className="text-[10px] opacity-70">/100</span>
    </Badge>
  );
}
