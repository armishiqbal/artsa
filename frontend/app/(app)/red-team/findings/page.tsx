"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { OutcomeBadge } from "@/components/red-team/OutcomeBadge";
import { Button } from "@/components/ui/button";
import { useCampaigns } from "@/lib/hooks/useCampaigns";
import { parseTopFindings } from "@/lib/campaignTranscript";
import { classifyFindingFamily } from "@/lib/redTeamOverview";
import { cn } from "@/lib/utils";

type Filter = "all" | "critical" | "open" | "resolved";

export default function RedTeamFindingsPage() {
  const search = useSearchParams();
  const focusCampaign = search.get("campaign");
  const { campaigns } = useCampaigns();
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const findings = useMemo(() => {
    const rows: Array<{
      id: string;
      campaignId: string;
      title: string;
      family: string;
      severity: string;
      path: string;
      detectionFail: boolean;
      leak: boolean;
      status: "open" | "resolved";
      reasoning: string;
    }> = [];

    for (const c of campaigns) {
      if (focusCampaign && c.id !== focusCampaign) continue;
      for (const f of parseTopFindings(c.summary ?? null)) {
        const sev = String(f.severity || "MEDIUM").toUpperCase();
        const hit =
          !f.blocked &&
          (f.attackSuccessScore >= 0.5 ||
            String(f.verdict).toUpperCase().includes("SUCCESS") ||
            sev.includes("HIGH") ||
            sev.includes("CRITICAL"));
        if (!hit && !focusCampaign) continue;
        const id = `${c.id}-r${f.roundNumber}`;
        rows.push({
          id,
          campaignId: c.id,
          title: f.attackName || "Finding",
          family: classifyFindingFamily(`${f.attackName} ${f.category}`),
          severity: sev,
          path: [f.category, f.attackName].filter(Boolean).join(" → ") || "attack path",
          detectionFail: !f.blocked,
          leak: f.attackSuccessScore >= 0.7,
          status: "open",
          reasoning: f.reasoning || f.objective || "",
        });
      }
    }
    return rows;
  }, [campaigns, focusCampaign]);

  const filtered = findings.filter((f) => {
    if (filter === "critical") return f.severity.includes("CRITICAL") || f.severity.includes("HIGH");
    if (filter === "open") return f.status === "open";
    if (filter === "resolved") return f.status === "resolved";
    return true;
  });

  const selected = findings.find((f) => f.id === (selectedId || filtered[0]?.id)) ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Findings</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Every meaningful failure becomes a finding with retestable evidence.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(["all", "critical", "open", "resolved"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-[12px] capitalize",
              filter === f
                ? "border-foreground/30 bg-muted text-foreground"
                : "border-border text-muted-foreground"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <ul className="divide-y divide-border rounded-md border border-border">
          {filtered.length === 0 ? (
            <li className="px-3 py-8 text-center text-[13px] text-muted-foreground">
              No findings yet.{" "}
              <Link href="/red-team/lab" className="underline-offset-2 hover:underline">
                Run Attack Lab
              </Link>
            </li>
          ) : (
            filtered.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(f.id)}
                  className={cn(
                    "flex w-full flex-col items-start gap-1 px-3 py-2.5 text-left hover:bg-muted/25",
                    selected?.id === f.id && "bg-muted/40"
                  )}
                >
                  <span className="font-mono text-[10px] text-muted-foreground">{f.id}</span>
                  <span className="text-[13px] font-medium">{f.title}</span>
                  <span className="text-[11px] text-muted-foreground">{f.family}</span>
                </button>
              </li>
            ))
          )}
        </ul>

        {selected ? (
          <article className="space-y-4 rounded-md border border-border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-mono text-[11px] text-muted-foreground">{selected.id}</p>
                <h3 className="mt-1 text-[15px] font-semibold">{selected.title}</h3>
              </div>
              <OutcomeBadge
                outcome={
                  selected.leak
                    ? "data_leaked"
                    : selected.detectionFail
                      ? "detection_failed"
                      : "safe"
                }
              />
            </div>

            <dl className="space-y-3 text-[13px]">
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Attack</dt>
                <dd>{selected.family}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Attack path
                </dt>
                <dd className="font-mono text-[12px]">{selected.path}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Detection
                </dt>
                <dd className="mt-1 space-y-1 text-[12px]">
                  <p>Input guard · {selected.detectionFail ? "miss" : "hit"}</p>
                  <p>Runtime · {selected.detectionFail ? "miss" : "hit"}</p>
                  <p>Authorization · {selected.leak ? "miss" : "hold"}</p>
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Impact</dt>
                <dd className="text-muted-foreground">
                  {selected.reasoning || "Review evidence for impact detail."}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Status</dt>
                <dd className="capitalize">{selected.status}</dd>
              </div>
            </dl>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" asChild>
                <Link href={`/red-team/evidence?campaign=${selected.campaignId}`}>Evidence</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href={`/red-team/findings/retest?id=${selected.id}`}>Retest</Link>
              </Button>
            </div>
          </article>
        ) : null}
      </div>
    </div>
  );
}
