"use client";

import { useMemo } from "react";
import Link from "next/link";
import { CoverageBar } from "@/components/red-team/CoverageBar";
import { useCampaigns } from "@/lib/hooks/useCampaigns";
import { deriveRedTeamOverview } from "@/lib/redTeamOverview";

export default function CoveragePage() {
  const { campaigns } = useCampaigns();
  const overview = useMemo(() => deriveRedTeamOverview(campaigns), [campaigns]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Red Team coverage</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          What you have actually tested — and the gaps that remain.
        </p>
      </div>

      <div className="space-y-3">
        {overview.coverage.map((row) => (
          <CoverageBar
            key={row.family}
            label={`${row.family} · ${row.tested} probes`}
            pct={row.tested === 0 ? 0 : row.pct}
          />
        ))}
      </div>

      <section className="rounded-md border border-dashed border-border px-4 py-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Untested surface
        </h3>
        {overview.untested.length === 0 ? (
          <p className="mt-2 text-[13px] text-muted-foreground">
            All tracked families have at least one probe in recent campaigns.
          </p>
        ) : (
          <ul className="mt-2 list-inside list-disc text-[13px] text-foreground">
            {overview.untested.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[12px] text-muted-foreground">
          Example gaps to prioritize: Memory → External data · Tool → Database · Agent → Cross-user
          data
        </p>
        <Link
          href="/red-team/lab"
          className="mt-3 inline-block text-[13px] underline-offset-2 hover:underline"
        >
          Cover gaps in Attack Lab →
        </Link>
      </section>
    </div>
  );
}
