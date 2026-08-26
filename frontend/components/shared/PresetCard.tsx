"use client";

import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PresetCardProps {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  active?: boolean;
  onClick: () => void;
  className?: string;
  badge?: string;
}

/** Selectable preset — border/state only, no lift animation. */
export function PresetCard({
  label,
  description,
  icon: Icon,
  active = false,
  onClick,
  className,
  badge,
}: PresetCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full surface-panel p-3.5 text-left transition-colors",
        active
          ? "border-foreground/25 bg-muted ring-1 ring-foreground/10"
          : "hover:border-foreground/15 hover:bg-muted/30",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted/50 text-muted-foreground",
            active && "border-foreground/20 text-foreground"
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-medium text-foreground">{label}</p>
            {badge && (
              <span className="rounded border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
                {badge}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
    </button>
  );
}
