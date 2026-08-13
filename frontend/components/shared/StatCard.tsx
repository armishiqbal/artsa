"use client";

import { motion } from "framer-motion";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import { Sparkline } from "@/components/shared/Sparkline";
import { cn } from "@/lib/utils";

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

interface StatCardProps {
  label: string;
  value: number | string;
  severity?: Severity;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: string;
  trendDirection?: "up" | "down";
  sparklineData?: number[];
  sparklineVariant?: "primary" | "success" | "warning" | "critical";
  className?: string;
}

const severityAccent: Record<Severity, string> = {
  CRITICAL: "from-severity-critical/10 border-severity-critical/25",
  HIGH: "from-severity-high/10 border-severity-high/25",
  MEDIUM: "from-severity-medium/10 border-severity-medium/25",
  LOW: "from-severity-low/10 border-severity-low/25",
};

const severityValue: Record<Severity, string> = {
  CRITICAL: "text-severity-critical",
  HIGH: "text-severity-high",
  MEDIUM: "text-severity-medium",
  LOW: "text-severity-low",
};

export function StatCard({
  label,
  value,
  severity,
  subtitle,
  icon: Icon,
  trend,
  trendDirection = "up",
  sparklineData,
  sparklineVariant = "primary",
  className,
}: StatCardProps) {
  const TrendIcon = trendDirection === "up" ? TrendingUp : TrendingDown;
  const trendColor = trendDirection === "up" ? "text-status-success" : "text-severity-critical";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <Card
        className={cn(
          "gradient-border overflow-hidden bg-gradient-to-br to-transparent transition-all hover:bg-card/90 hover:shadow-glow-sm",
          severity && severityAccent[severity],
          className
        )}
      >
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
            <div className="flex items-center gap-2">
              {severity && <SeverityBadge severity={severity} />}
              {Icon && !severity && (
                <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
              )}
            </div>
          </div>
          <div className="mt-2 flex items-end justify-between gap-2">
            <p
              className={cn(
                "font-mono text-3xl font-semibold tabular-nums leading-none",
                severity && severityValue[severity]
              )}
            >
              {value}
            </p>
            {sparklineData && sparklineData.length >= 2 && (
              <Sparkline
                data={sparklineData}
                width={72}
                height={28}
                variant={sparklineVariant}
                className="mb-0.5"
              />
            )}
          </div>
          {(subtitle || trend) && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              {trend && (
                <>
                  <TrendIcon className={cn("h-3 w-3", trendColor)} aria-hidden />
                  <span>{trend}</span>
                </>
              )}
              {subtitle && <span>{subtitle}</span>}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
