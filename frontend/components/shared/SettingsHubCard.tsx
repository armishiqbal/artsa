"use client";

import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface HubStat {
  label: string;
  value: number;
}

interface SettingsHubCardProps {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  stats: HubStat[];
  index?: number;
  className?: string;
}

export function SettingsHubCard({
  title,
  description,
  href,
  icon: Icon,
  stats,
  className,
}: SettingsHubCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex w-full flex-col gap-3 rounded-xl border border-border/80 bg-card p-4 transition-colors duration-150 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4 hover:border-primary/40 hover:bg-muted/20 shadow-xs",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/80 bg-muted/40 text-foreground transition-colors group-hover:border-primary/40 group-hover:bg-primary/10 group-hover:text-primary">
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary">
            {title}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1 sm:line-clamp-none">
            {description}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-end">
        <div className="flex flex-wrap items-center gap-2">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-muted/30 px-3 py-1 text-xs font-medium text-foreground"
            >
              <span className="font-mono font-bold text-foreground tabular-nums">
                {stat.value}
              </span>
              <span className="text-[11px] text-muted-foreground">{stat.label}</span>
            </div>
          ))}
        </div>

        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-all duration-150 group-hover:translate-x-1 group-hover:text-foreground/90">
          <ArrowRight className="h-4 w-4" aria-hidden />
        </div>
      </div>
    </Link>
  );
}
