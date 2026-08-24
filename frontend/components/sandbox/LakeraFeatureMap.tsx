"use client";

import Link from "next/link";
import { ChevronDown, ExternalLink, Shield } from "lucide-react";
import {
  LAKERA_FEATURE_CATEGORIES,
  LAKERA_FEATURE_COUNT,
} from "@/lib/lakeraFeatures";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface LakeraFeatureMapProps {
  className?: string;
  /** Collapse categories by default (reference page). */
  defaultCollapsed?: boolean;
}

export function LakeraFeatureMap({
  className,
  defaultCollapsed = false,
}: LakeraFeatureMapProps) {
  return (
    <div className={cn("rounded-xl border border-border bg-card shadow-card", className)}>
      <div className="border-b border-border px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" aria-hidden />
          <h2 className="text-base font-semibold tracking-tight">Lakera Guard capability map</h2>
          <Badge variant="secondary" className="text-[10px]">
            {LAKERA_FEATURE_COUNT} items
          </Badge>
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground max-w-2xl">
          Reference catalog for Check Point AI Guardrails. Each row links to where ARTSA covers the same control.
        </p>
      </div>

      <div className="divide-y divide-border">
        {LAKERA_FEATURE_CATEGORIES.map((category, index) => (
          <details
            key={category.id}
            className="group"
            open={!defaultCollapsed && index === 0}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 sm:px-6 hover:bg-muted/30 [&::-webkit-details-marker]:hidden">
              <div className="min-w-0">
                <p className="text-sm font-medium">{category.name}</p>
                <p className="text-xs text-muted-foreground">{category.summary}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="outline" className="text-[10px] font-normal">
                  {category.features.length}
                </Badge>
                <ChevronDown
                  className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180"
                  aria-hidden
                />
              </div>
            </summary>
            <div className="border-t border-border/60 bg-muted/5 px-4 pb-4 pt-2 sm:px-6">
              <ul className="space-y-2">
                {category.features.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-col gap-1 rounded-lg border border-border/60 bg-card px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{row.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{row.description}</p>
                    </div>
                    <Link
                      href={row.href}
                      className="inline-flex shrink-0 items-center gap-1 text-xs font-medium hover:underline sm:pt-0.5"
                    >
                      {row.artsa}
                      <ExternalLink className="h-3 w-3 opacity-60" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
