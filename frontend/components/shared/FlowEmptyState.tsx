"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { computeReadinessFromMilestones } from "@/lib/readinessFlow";
import { useConnection } from "@/lib/context/ConnectionProvider";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

export function FlowEmptyState({
  title,
  hasTraffic = false,
  className,
}: {
  title: string;
  hasTraffic?: boolean;
  className?: string;
}) {
  const { apiOnline, wsConnected } = useConnection();
  const flow = useMemo(
    () => computeReadinessFromMilestones({ apiOnline, wsConnected, hasTraffic }),
    [apiOnline, wsConnected, hasTraffic]
  );

  return (
    <div className={cn("empty-flow surface-inset px-4 py-8 text-center", className)}>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{flow.blockers[0]}</p>
      <Progress value={flow.score} className="mx-auto mt-4 h-1.5 max-w-xs" aria-label="Setup progress" />
      <p className="mt-1.5 text-[10px] tabular-nums text-muted-foreground">{flow.score}% ready</p>
      <Button asChild size="sm" className="interactive-pill mt-4 gap-1.5">
        <Link href={flow.nextAction.href}>
          {flow.nextAction.label}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </Button>
    </div>
  );
}
