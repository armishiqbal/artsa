"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useCampaigns } from "@/lib/hooks/useCampaigns";
import { parseTopFindings } from "@/lib/campaignTranscript";

/** Scoring view from live campaign judge verdicts — actions to produce the next scores. */
export default function ScoringPage() {
  const { campaigns, loading } = useCampaigns();

  const stats = useMemo(() => {
    const verdicts = new Map<string, number>();
    const severities = new Map<string, number>();
    let scored = 0;
    let withReasoning = 0;
    let successSum = 0;
    let defenseSum = 0;
    let hotCampaignId: string | null = null;

    for (const c of campaigns) {
      for (const f of parseTopFindings(c.summary ?? null)) {
        scored += 1;
        if (!hotCampaignId) hotCampaignId = c.id;
        const v = String(f.verdict || "UNKNOWN").toUpperCase();
        verdicts.set(v, (verdicts.get(v) ?? 0) + 1);
        const sev = String(f.severity || "MEDIUM").toUpperCase();
        severities.set(sev, (severities.get(sev) ?? 0) + 1);
        if (f.reasoning) withReasoning += 1;
        successSum += f.attackSuccessScore;
        defenseSum += f.defenseQualityScore;
      }
    }

    return {
      scored,
      withReasoning,
      avgAttack: scored ? Math.round((successSum / scored) * 1000) / 10 : null,
      avgDefense: scored ? Math.round((defenseSum / scored) * 1000) / 10 : null,
      verdicts: [...verdicts.entries()].sort((a, b) => b[1] - a[1]),
      severities: [...severities.entries()].sort((a, b) => b[1] - a[1]),
      hotCampaignId,
    };
  }, [campaigns]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-xl text-[13px] text-muted-foreground">
          Judge outputs from live campaigns — probe or launch to score the next round.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link href="/red-team/lab">Probe in Lab</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/red-team/campaigns/new">Launch campaign</Link>
          </Button>
          {stats.hotCampaignId ? (
            <Button size="sm" variant="outline" asChild>
              <Link href={`/red-team/monitor/${stats.hotCampaignId}?follow=1`}>Open theater</Link>
            </Button>
          ) : (
            <Button size="sm" variant="outline" asChild>
              <Link href="/red-team/monitor">Monitor</Link>
            </Button>
          )}
        </div>
      </div>

      {loading && campaigns.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Loading campaigns…</p>
      ) : stats.scored === 0 ? (
        <div className="rounded-md border border-dashed border-border px-4 py-8 text-center">
          <p className="text-[13px] text-muted-foreground">No scored rounds yet.</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Button size="sm" asChild>
              <Link href="/red-team/lab">Probe now</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/red-team/campaigns/new">Launch campaign</Link>
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                ["Scored rounds", String(stats.scored)],
                ["With rationale", String(stats.withReasoning)],
                ["Avg attack %", stats.avgAttack != null ? `${stats.avgAttack}` : "—"],
                ["Avg defense %", stats.avgDefense != null ? `${stats.avgDefense}` : "—"],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-md border border-border px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
                <p className="mt-1 font-mono text-xl font-semibold tabular-nums">{value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <section className="rounded-md border border-border p-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Verdict mix
              </h3>
              <ul className="mt-2 space-y-1.5 font-mono text-[12px]">
                {stats.verdicts.map(([name, n]) => (
                  <li key={name} className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{name}</span>
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="rounded-md border border-border p-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Severity mix
              </h3>
              <ul className="mt-2 space-y-1.5 font-mono text-[12px]">
                {stats.severities.map(([name, n]) => (
                  <li key={name} className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{name}</span>
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
