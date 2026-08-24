"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { ReadinessFlowState } from "@/lib/readinessFlow";
import { cn } from "@/lib/utils";

export function SetupProgressBanner({
  flow,
  className,
}: {
  flow: ReadinessFlowState;
  className?: string;
}) {
  if (flow.productionReady) return null;

  return (
    <div
      className={cn(
        "surface-panel overflow-hidden px-4 py-4 sm:flex sm:items-center sm:justify-between sm:gap-4",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Setup in progress</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {flow.blockers[0] ?? "Finish the setup guide to see live activity on this dashboard."}
        </p>
        <Progress value={flow.score} className="mt-3 h-1.5 max-w-md" aria-label="Setup progress" />
        <p className="mt-1 text-[10px] tabular-nums text-muted-foreground">{flow.score}% ready</p>
      </div>
      <Button asChild size="sm" className="interactive-pill mt-3 shrink-0 sm:mt-0">
        <Link href={flow.nextAction.href}>
          {flow.nextAction.label}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </Button>
    </div>
  );
}
