"use client";

import { Download, FileArchive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/components/shared/DashboardCard";
import {
  buildFypMarkdown,
  downloadTextFile,
  findingsToExportRows,
  type FypExportPayload,
} from "@/lib/fypExport";
import type { ServerFinding } from "@/lib/hooks/useFindings";
import type { CampaignListItem } from "@/lib/hooks/useCampaigns";

interface FypExportPanelProps {
  findings: ServerFinding[];
  campaigns: CampaignListItem[];
  playbookVersion: number;
  defenseScore: number;
  threatsBlocked: number;
}

export function FypExportPanel({
  findings,
  campaigns,
  playbookVersion,
  defenseScore,
  threatsBlocked,
}: FypExportPanelProps) {
  const exportMarkdown = () => {
    const payload: FypExportPayload = {
      generatedAt: new Date().toISOString(),
      playbookVersion,
      findingsCount: findings.length,
      campaignsCount: campaigns.length,
      defenseScore,
      threatsBlocked,
      findings: findingsToExportRows(findings),
    };
    downloadTextFile(
      `artsa-fyp-evidence-${new Date().toISOString().slice(0, 10)}.md`,
      buildFypMarkdown(payload)
    );
  };

  return (
    <DashboardCard
      title="FYP evidence pack"
      description="One-click markdown export for demos, viva, and portfolio — findings, playbook version, and architecture summary."
    >
      <Button size="sm" className="interactive-pill gap-2" onClick={exportMarkdown}>
        <Download className="h-3.5 w-3.5" />
        Export markdown pack
      </Button>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <FileArchive className="h-3 w-3" aria-hidden />
        Includes top findings table + executive KPIs
      </p>
    </DashboardCard>
  );
}
