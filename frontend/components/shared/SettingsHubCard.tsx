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
        "group surface-panel flex h-full flex-col p-6 transition-colors hover:border-foreground/20 hover:bg-muted/20",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/80 bg-muted/50 text-muted-foreground transition-colors group-hover:text-foreground">
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <ArrowRight
          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-foreground"
          aria-hidden
        />
      </div>
      <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
      <div className="mt-auto flex flex-wrap gap-5 pt-5">
        {stats.map((stat) => (
          <div key={stat.label}>
            <p className="font-mono text-xl font-semibold tabular-nums text-foreground">
              {stat.value}
            </p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>
    </Link>
  );
}
