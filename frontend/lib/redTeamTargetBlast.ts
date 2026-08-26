/**
 * Target blast graph — providers as hubs, campaigns as spokes (live data only).
 */

import type { CampaignListItem } from "@/lib/hooks/useCampaigns";
import { riskScoreFromSummary } from "@/lib/assessmentResults";

export interface TargetBlastSpoke {
  campaignId: string;
  label: string;
  status: string;
  riskScore: number | null;
}

export interface TargetBlastNode {
  targetId: string;
  targetName: string;
  model: string;
  configured: boolean;
  spokes: TargetBlastSpoke[];
}

export function matchCampaignsForTarget(
  target: { id: string; name: string },
  campaigns: CampaignListItem[]
): TargetBlastSpoke[] {
  const id = target.id.toLowerCase();
  const name = target.name.toLowerCase();
  return campaigns
    .filter((c) => {
      const p = String(c.provider ?? "").toLowerCase();
      return p === id || p === name || p.includes(id) || id.includes(p);
    })
    .map((c) => {
      const summary = (c.summary as Record<string, unknown> | undefined) ?? null;
      return {
        campaignId: c.id,
        label: c.name || c.id,
        status: String(c.status ?? "UNKNOWN"),
        riskScore: riskScoreFromSummary(summary),
      };
    });
}

export function buildTargetBlastGraph(
  targets: Array<{ id: string; name: string; model: string; configured: boolean }>,
  campaigns: CampaignListItem[]
): TargetBlastNode[] {
  return targets.map((t) => ({
    targetId: t.id,
    targetName: t.name,
    model: t.model,
    configured: t.configured,
    spokes: matchCampaignsForTarget(t, campaigns),
  }));
}
