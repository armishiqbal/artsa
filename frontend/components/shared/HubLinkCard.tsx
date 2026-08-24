"use client";

import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { IconTile } from "@/components/shared/IconTile";
import { cn } from "@/lib/utils";

interface HubLinkCardProps {
  href: string;
  label: string;
  value: number | string;
  hint: string;
  icon: LucideIcon;
  className?: string;
}

/** Admin/settings hub metric — links to a destination with count + caption. */
export function HubLinkCard({ href, label, value, hint, icon: Icon, className }: HubLinkCardProps) {
  return (
    <Link href={href} className={cn("hub-link-card group", className)}>
      <div className="flex items-start justify-between gap-3">
        <IconTile size="lg">
          <Icon aria-hidden />
        </IconTile>
        <ArrowRight
          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-foreground"
          aria-hidden
        />
      </div>
      <p className="mt-4 font-mono text-2xl font-semibold tabular-nums leading-none text-foreground">
        {value}
      </p>
      <p className="mt-2 text-sm font-medium text-foreground">{label}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{hint}</p>
    </Link>
  );
}
