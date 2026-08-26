"use client";

import { FeatureLinkCard } from "@/components/shared/FeatureLinkCard";
import { Crosshair, ScrollText, Bug, Network } from "lucide-react";
import { cn } from "@/lib/utils";

interface RedTeamQuickLinksProps {
  campaignId?: string | null;
  findingsCount?: number;
  className?: string;
}

/** workflow shortcuts from the console. */
export function RedTeamQuickLinks({ campaignId, findingsCount, className }: RedTeamQuickLinksProps) {
  const replayHref = campaignId
    ? `/replay?session=${encodeURIComponent(campaignId)}`
    : "/replay";

  return (
    <div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-4", className)}>
      <FeatureLinkCard
        title="Playground"
        description="Single-shot probe before a full scan"
        href="/sandbox"
        icon={Crosshair}
        badge="Fast"
      />
      <FeatureLinkCard
        title="Findings"
        description="Triage and promote issues to playbook"
        href="/findings"
        icon={Bug}
        badge={findingsCount ? `${findingsCount} open` : undefined}
      />
      <FeatureLinkCard
        title="Session replay"
        description="Forensic autopsy for this evaluation"
        href={replayHref}
        icon={ScrollText}
      />
      <FeatureLinkCard
        title="Agent pipeline"
        description="Closed-loop Research → Defender flow"
        href="/pipeline"
        icon={Network}
      />
    </div>
  );
}
