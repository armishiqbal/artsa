"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useCampaigns } from "@/lib/hooks/useCampaigns";
import { parseTopFindings } from "@/lib/campaignTranscript";
import { classifyFindingFamily, deriveRedTeamOverview } from "@/lib/redTeamOverview";

/** Research framing from live campaign API data — no fake EXP-* demo cards. */
export default function ResearchModePage() {
  const { campaigns, loading } = useCampaigns();
  const overview = useMemo(() => deriveRedTeamOverview(campaigns), [campaigns]);

  const focus = useMemo(() => {
    const running = campaigns.find((c) => {
      const s = String(c.status).toUpperCase();
      return s === "RUNNING" || s === "PENDING";
    });
    const completed = campaigns.find((c) => String(c.status).toUpperCase() === "COMPLETED");
    return running ?? completed ?? campaigns[0] ?? null;
  }, [campaigns]);

  const findings = useMemo(() => parseTopFindings(focus?.summary ?? null), [focus]);
  const family = findings[0]
    ? classifyFindingFamily(`${findings[0].attackName} ${findings[0].category}`)
    : overview.coverage.find((c) => c.tested > 0)?.family ?? "—";

  const defaultHypothesis = focus
    ? `Campaign “${focus.name}” (${focus.provider}/${focus.model}) — ${findings.length} findings, ${focus.rounds_completed}/${focus.total_rounds} rounds. Hypothesis: defenses fail on ${family}.`
    : "Connect a provider and run a campaign to frame a live experiment.";

  const [hypothesis, setHypothesis] = useState(defaultHypothesis);

  useEffect(() => {
    setHypothesis(defaultHypothesis);
  }, [defaultHypothesis]);

  const fields = focus
    ? ([
        ["Campaign ID", focus.id],
        ["Status", String(focus.status).toUpperCase()],
        ["Attack family (sample)", family],
        ["Model", `${focus.provider} / ${focus.model}`],
        ["Trials (rounds)", `${focus.rounds_completed} / ${focus.total_rounds}`],
        ["Detect rate", overview.detectPct != null ? `${overview.detectPct}%` : "—"],
      ] as const)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Research</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Experiment framing from live campaigns — Ops / Research toggle is in the Red Team header.
          </p>
        </div>
        <Button size="sm" variant="outline" asChild>
          <Link href="/red-team/campaigns/new">New campaign</Link>
        </Button>
      </div>

      {loading && !focus ? (
        <p className="text-[13px] text-muted-foreground">Loading campaigns…</p>
      ) : !fields ? (
        <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-[13px] text-muted-foreground">
          No campaigns yet. Launch one to populate research fields from the API.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map(([k, v]) => (
            <div key={k} className="rounded-md border border-border px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</p>
              <p className="mt-1 break-all font-mono text-[12px]">{v}</p>
            </div>
          ))}
          <label className="space-y-1 text-[12px] sm:col-span-2">
            <span className="text-muted-foreground">Hypothesis</span>
            <textarea
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px]"
              value={hypothesis}
              onChange={(e) => setHypothesis(e.target.value)}
            />
          </label>
        </div>
      )}

      {focus ? (
        <Button size="sm" variant="outline" asChild>
          <Link href={`/red-team/monitor/${focus.id}`}>Open campaign theater</Link>
        </Button>
      ) : null}
    </div>
  );
}
