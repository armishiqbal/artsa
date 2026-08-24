"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import { Sparkline } from "@/components/shared/Sparkline";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

interface StatCardProps {
  label: string;
  value: number | string;
  severity?: Severity;
  /** Caption under the number — e.g. "In archive", "Successful runs" */
  subtitle?: string;
  icon?: LucideIcon;
  trend?: string;
  trendDirection?: "up" | "down";
  sparklineData?: number[];
  sparklineVariant?: "primary" | "success" | "warning" | "critical";
  className?: string;
  href?: string;
  onClick?: () => void;
  /** 0–1 ratio — thin progress under value (e.g. keys configured) */
  progress?: number;
  /** Subtle active indicator (e.g. proxy enabled) */
  active?: boolean;
  /** default = dashboard row; compact = inline readiness counters */
  variant?: "default" | "compact";
}

/**
 * Static result metric — label, primary value, caption. No motion.
 * Styled via `.metric-result-card` tokens (light + dark).
 */
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
  href,
  onClick,
  progress,
  active,
  variant = "default",
}: StatCardProps) {
  const TrendIcon = trendDirection === "up" ? TrendingUp : TrendingDown;
  const compact = variant === "compact";
  const interactive = Boolean(href || onClick);

  const card = (
    <motion.div
      data-severity={severity}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      whileHover={interactive ? { y: -2, transition: { duration: 0.2 } } : undefined}
      className={cn(
        "metric-result-card motion-card",
        interactive && "cursor-pointer transition-colors hover:border-foreground/20",
        active && "ring-1 ring-inset ring-foreground/10",
        compact && "metric-result-card--compact",
        className
      )}
    >
      <div className={cn(compact ? "px-3 py-2.5" : "p-5")}>
        <div className="flex items-start justify-between gap-2">
          <span
            className={cn(
              "metric-result-label font-medium uppercase tracking-wider",
              compact ? "text-[10px] leading-snug" : "text-[11px]"
            )}
          >
            {label}
          </span>
          <div className="flex shrink-0 items-center gap-1.5">
            {severity && <SeverityBadge severity={severity} />}
            {Icon && !severity && (
              <Icon
                className={cn("metric-result-label opacity-80", compact ? "h-3.5 w-3.5" : "h-4 w-4")}
                aria-hidden
              />
            )}
            {active && (
              <span
                className="h-1.5 w-1.5 rounded-full bg-foreground"
                title="Active"
                aria-hidden
              />
            )}
          </div>
        </div>

        <div className={cn("flex items-end justify-between gap-2", compact ? "mt-1.5" : "mt-3")}>
          <p
            className={cn(
              "metric-result-value font-mono font-semibold tabular-nums leading-none text-foreground",
              compact ? "text-xl" : "text-3xl tracking-tight"
            )}
          >
            {value}
          </p>
          {!compact && sparklineData && sparklineData.length >= 2 && (
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
          <div
            className={cn(
              "metric-result-caption",
              compact ? "mt-1 text-[10px] leading-snug" : "mt-2 flex items-center gap-1.5 text-xs"
            )}
          >
            {trend && !compact && (
              <>
                <TrendIcon className="h-3 w-3 shrink-0" aria-hidden />
                <span>{trend}</span>
              </>
            )}
            {subtitle && <span>{subtitle}</span>}
          </div>
        )}

        {progress != null && !compact && (
          <Progress
            value={Math.min(100, Math.max(0, progress * 100))}
            className="mt-3 h-1 bg-muted"
            aria-label={`${label} progress`}
          />
        )}
      </div>
    </motion.div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {card}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="block w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {card}
      </button>
    );
  }

  return card;
}
