"use client";

import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RiskScore } from "@/components/shared/RiskScore";
import { cn } from "@/lib/utils";
import type { TopologyThreat } from "@/lib/hooks/useTopologyThreats";

function severityFromScore(score: number): "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" {
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

interface ThreatRowProps {
  threat: TopologyThreat;
  rank?: number;
  className?: string;
}

export function ThreatRow({ threat, rank, className }: ThreatRowProps) {
  const router = useRouter();
  const severity = severityFromScore(threat.risk_score);
  const action =
    threat.status === "BREACHED" ? "TERMINATED" : threat.status === "QUARANTINED" ? "QUARANTINED" : "MONITOR";

  return (
    <button
      type="button"
      className={cn(
        "group w-full rounded-xl border border-border bg-muted/20 p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/40",
        className
      )}
      onClick={() => router.push(`/replay?session=${threat.session_id}`)}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {rank !== undefined && (
            <span className="shrink-0 font-mono text-xs font-bold text-muted-foreground">#{rank}</span>
          )}
          <span className="truncate text-sm font-medium group-hover:text-primary">
            {threat.agent_id} — {threat.status}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge
            variant={
              severity === "CRITICAL" ? "critical" : severity === "HIGH" ? "warning" : "secondary"
            }
            className="text-[10px]"
          >
            {severity}
          </Badge>
          <RiskScore score={threat.risk_score} />
          <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
        </div>
      </div>
      <p className="mt-2 font-mono text-xs leading-relaxed text-muted-foreground">
        {threat.breaches} containment breach{threat.breaches === 1 ? "" : "es"} · session{" "}
        {threat.session_id.slice(0, 8)}… · {action}
      </p>
    </button>
  );
}
