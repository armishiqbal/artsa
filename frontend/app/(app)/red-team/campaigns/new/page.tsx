"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { fetchFromBackend } from "@/lib/api";
import {
  intensityFromMatrix,
  mergeCampaignCategories,
  mutationsForIntensity,
} from "@/lib/redTeamAttackSets";
import { toast } from "@/lib/stores/toast";
import { cn } from "@/lib/utils";

const ATTACK_SETS = [
  "Prompt Injection",
  "Tool Abuse",
  "Data Exfiltration",
  "Goal Manipulation",
  "Memory Poisoning",
] as const;

const MATRIX_ROWS = ["Injection", "Tool Abuse", "Exfiltration", "Goal Drift"] as const;
const INTENSITIES = ["Low", "Med", "High"] as const;

export default function CampaignBuilderPage() {
  const router = useRouter();
  const [name, setName] = useState("Production Agent Assessment");
  const [agent, setAgent] = useState("Customer Support");
  const [model, setModel] = useState("Auto");
  const [tools, setTools] = useState("Search / Database / Email");
  const [sets, setSets] = useState<string[]>([
    "Prompt Injection",
    "Tool Abuse",
    "Data Exfiltration",
    "Goal Manipulation",
  ]);
  const [matrix, setMatrix] = useState<Record<string, Record<string, boolean>>>(() => {
    const init: Record<string, Record<string, boolean>> = {};
    for (const row of MATRIX_ROWS) {
      init[row] = { Low: true, Med: true, High: row !== "Goal Drift" };
    }
    return init;
  });
  const [iterations, setIterations] = useState(10);
  const [launching, setLaunching] = useState(false);

  const categories = useMemo(() => mergeCampaignCategories(sets, matrix), [sets, matrix]);
  const intensity = useMemo(() => intensityFromMatrix(matrix), [matrix]);
  const mut = useMemo(() => mutationsForIntensity(intensity), [intensity]);

  const toggleSet = (s: string) =>
    setSets((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const toggleCell = (row: string, col: string) =>
    setMatrix((prev) => ({
      ...prev,
      [row]: { ...prev[row], [col]: !prev[row]?.[col] },
    }));

  const launch = async () => {
    if (categories.length === 0) {
      toast("Select at least one attack", {
        description: "Enable an attack set or matrix cell before launch.",
        variant: "error",
      });
      return;
    }
    setLaunching(true);
    const modelTrim = model.trim();
    const useAuto = !modelTrim || modelTrim.toLowerCase() === "auto";
    const res = await fetchFromBackend<{ campaign_id?: string; message?: string }>(
      "/api/v1/campaigns/baseline",
      {
        method: "POST",
        body: JSON.stringify({
          name: name.trim() || "Red Team campaign",
          max_rounds: Math.max(1, Math.min(100, Math.floor(iterations) || 10)),
          categories,
          intensity,
          mutations_enabled: mut.mutations_enabled,
          max_mutations_per_attack: mut.max_mutations_per_attack,
          target_agent: agent.trim() || null,
          target_tools: tools.trim() || null,
          ...(useAuto ? {} : { model: modelTrim }),
        }),
        timeoutMs: 20_000,
      }
    );
    setLaunching(false);
    if (!res?.campaign_id) {
      toast("Campaign not started", {
        description:
          "Check target provider keys, or lower iterations (1–100). Then launch again.",
        variant: "error",
      });
      return;
    }
    toast("Campaign launched", {
      description: `${categories.length} categories · ${intensity} intensity · ${res.message || res.campaign_id}`,
      variant: "success",
    });
    router.push(`/red-team/monitor/${res.campaign_id}?follow=1`);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Create campaign</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Attack sets and matrix drive real categories on the target — then watch campaign rounds
          live.
        </p>
      </div>

      <section className="space-y-2">
        <label className="block space-y-1 text-[12px]">
          <span className="text-muted-foreground">Campaign</span>
          <input
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px]"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1 text-[12px]">
            <span className="text-muted-foreground">Agent</span>
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px]"
              value={agent}
              onChange={(e) => setAgent(e.target.value)}
            />
          </label>
          <label className="space-y-1 text-[12px]">
            <span className="text-muted-foreground">Model</span>
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px]"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Auto"
            />
          </label>
          <label className="space-y-1 text-[12px]">
            <span className="text-muted-foreground">Tools</span>
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px]"
              value={tools}
              onChange={(e) => setTools(e.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Attack set
          </h3>
          <span className="font-mono text-[10px] text-muted-foreground">
            {categories.length} cats · {intensity}
          </span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {ATTACK_SETS.map((s) => (
            <label key={s} className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={sets.includes(s)} onChange={() => toggleSet(s)} />
              {s}
            </label>
          ))}
        </div>
        {categories.length > 0 ? (
          <p className="font-mono text-[10px] text-muted-foreground">
            Codes: {categories.join(", ")}
          </p>
        ) : null}
      </section>

      <section className="space-y-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Test matrix
        </h3>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[360px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-border bg-muted/20 text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">Attack</th>
                {INTENSITIES.map((i) => (
                  <th key={i} className="px-3 py-2 font-medium">
                    {i}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATRIX_ROWS.map((row) => (
                <tr key={row} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 text-foreground">{row}</td>
                  {INTENSITIES.map((col) => (
                    <td key={col} className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => toggleCell(row, col)}
                        className={cn(
                          "font-mono text-[13px]",
                          matrix[row]?.[col] ? "text-foreground" : "text-muted-foreground/40"
                        )}
                        aria-pressed={matrix[row]?.[col]}
                      >
                        {matrix[row]?.[col] ? "✓" : "—"}
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Highest checked intensity ({intensity}) sets mutation aggressiveness on the backend.
        </p>
      </section>

      <label className="block max-w-xs space-y-1 text-[12px]">
        <span className="text-muted-foreground">Iterations (1–100)</span>
        <input
          type="number"
          min={1}
          max={100}
          className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-[13px]"
          value={iterations}
          onChange={(e) => {
            const n = Number(e.target.value);
            setIterations(Number.isFinite(n) ? Math.max(1, Math.min(100, n)) : 1);
          }}
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href="/red-team/campaigns">Back</Link>
        </Button>
        <Button size="sm" onClick={() => void launch()} disabled={launching || categories.length === 0}>
          {launching ? "Launching…" : "Launch campaign"}
        </Button>
      </div>
    </div>
  );
}
