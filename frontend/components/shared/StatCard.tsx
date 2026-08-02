"use client";

import { motion } from "framer-motion";
import { LucideIcon, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import { cn } from "@/lib/utils";

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

interface StatCardProps {
  label: string;
  value: number | string;
  severity?: Severity;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: string;
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

export function StatCard({ label, value, severity, subtitle, icon: Icon, trend, className }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <Card
        className={cn(
          "gradient-border overflow-hidden bg-gradient-to-br to-transparent transition-colors hover:bg-card/90",
          severity && severityAccent[severity],
          className
        )}
      >
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
            {severity && <SeverityBadge severity={severity} />}
            {Icon && !severity && (
              <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
            )}
          </div>
          <p className={cn("mt-3 font-mono text-3xl font-semibold tabular-nums", severity && severityValue[severity])}>
            {value}
          </p>
          {(subtitle || trend) && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              {trend && (
                <>
                  <TrendingUp className="h-3 w-3 text-emerald-400" aria-hidden />
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
