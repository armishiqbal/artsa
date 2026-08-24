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
        "group flex items-center gap-3 rounded-lg border border-border bg-muted/10 p-4 transition-colors hover:border-foreground/15 hover:bg-muted/40",
        className
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/70 bg-card text-muted-foreground transition-colors group-hover:text-foreground">
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </Link>
  );
}
