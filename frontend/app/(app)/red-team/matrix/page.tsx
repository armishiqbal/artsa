"use client";

import { useMemo } from "react";
import Link from "next/link";
import { OutcomeBadge } from "@/components/red-team/OutcomeBadge";
import { useCampaigns } from "@/lib/hooks/useCampaigns";
import { parseTopFindings } from "@/lib/campaignTranscript";
import { classifyFindingFamily } from "@/lib/redTeamOverview";
import { deriveRoundSecurity } from "@/lib/liveMonitorSecurity";

export default function ResultMatrixPage() {
  const { campaigns } = useCampaigns();

  const rows = useMemo(() => {
    const out: Array<{
      attack: string;
      detection: string;
      prevention: string;
      leak: string;
      result: string;
      href: string;
    }> = [];

    for (const c of campaigns) {
      for (const f of parseTopFindings(c.summary ?? null)) {
        const family = classifyFindingFamily(`${f.attackName} ${f.category}`);
        const axes = deriveRoundSecurity(f);
        if (!axes) continue;
        out.push({
          attack: family,
          detection: axes.detection,
          prevention: axes.prevention,
          leak: axes.leak,
          result: axes.result,
          href: `/red-team/monitor/${c.id}`,
        });
      }
    }

    return out.slice(0, 24);
  }, [campaigns]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Attack result matrix</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Detection · Prevention · Leak · Result — v2 outcome vocabulary.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-md border border-border px-4 py-8 text-center text-[13px] text-muted-foreground">
          No evaluated attacks yet.{" "}
          <Link href="/red-team/lab" className="underline-offset-2 hover:underline">
            Run Attack Lab
          </Link>
          .
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[640px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-border bg-muted/20 text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">Attack</th>
                <th className="px-3 py-2 font-medium">Detection</th>
                <th className="px-3 py-2 font-medium">Prevention</th>
                <th className="px-3 py-2 font-medium">Leak</th>
                <th className="px-3 py-2 font-medium">Result</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={`${row.attack}-${i}`} className="border-b border-border last:border-0">
                  <td className="px-3 py-2.5">
                    <Link href={row.href} className="font-medium hover:underline">
                      {row.attack}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <OutcomeBadge kind="detection" value={row.detection} />
                  </td>
                  <td className="px-3 py-2.5">
                    <OutcomeBadge kind="prevention" value={row.prevention} />
                  </td>
                  <td className="px-3 py-2.5">
                    <OutcomeBadge kind="leak" value={row.leak} />
                  </td>
                  <td className="px-3 py-2.5">
                    <OutcomeBadge kind="result" value={row.result} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
