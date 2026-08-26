"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickActionTileProps {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  className?: string;
}

export function QuickActionTile({
  href,
  title,
  description,
  icon: Icon,
  className,
}: QuickActionTileProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-lg border border-border bg-card p-3.5 transition-colors duration-150 hover:border-muted-foreground hover:bg-muted/30",
        className
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-foreground">
        <Icon className="h-4 w-4" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-foreground truncate">
          {title}
        </p>
        <p className="text-[11px] text-muted-foreground truncate">{description}</p>
      </div>
    </Link>
  );
}
