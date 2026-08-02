"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SeverityBadgeProps {
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  className?: string;
}

const variantMap = {
  LOW: "info" as const,
  MEDIUM: "warning" as const,
  HIGH: "warning" as const,
  CRITICAL: "critical" as const,
};

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  return (
    <Badge
      variant={variantMap[severity]}
      className={cn("font-mono text-[10px] uppercase", severity === "CRITICAL" && "animate-pulse", className)}
      aria-label={`Severity: ${severity}`}
    >
      {severity}
    </Badge>
  );
}
