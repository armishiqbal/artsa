"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { computeReadinessFromMilestones } from "@/lib/readinessFlow";
import { useMemo } from "react";

/** Logs empty state — same next-action logic as Command Center setup banner. */
export function LogsSetupEmpty({
  apiOnline,
  wsConnected,
  hasEvents,
}: {
  apiOnline: boolean;
  wsConnected: boolean;
  hasEvents: boolean;
}) {
  const flow = useMemo(
    () =>
      computeReadinessFromMilestones({
        apiOnline,
        wsConnected,
        hasTraffic: hasEvents,
      }),
    [apiOnline, wsConnected, hasEvents]
  );

  if (hasEvents) return null;

  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/10 px-4 py-5 text-center">
      <p className="text-sm font-medium">No screening requests yet</p>
      <p className="mt-1 text-xs text-muted-foreground">{flow.blockers[0]}</p>
      <Progress value={flow.score} className="mx-auto mt-3 h-1.5 max-w-xs" />
      <Button asChild size="sm" className="mt-4 gap-1.5">
        <Link href={flow.nextAction.href}>
          {flow.nextAction.label}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </Button>
    </div>
  );
}
