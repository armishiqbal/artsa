"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FRIENDLY_TECHNIQUE,
  RedTeamSimpleSteps,
} from "@/components/red-team/RedTeamGlossary";
import { Button } from "@/components/ui/button";
import { fetchFromBackend } from "@/lib/api";
import {
  intensityFromMatrix,
  mergeCampaignCategories,
  mutationsForIntensity,
} from "@/lib/redTeamAttackSets";
import { toast } from "@/lib/stores/toast";
import { kindLabel, type Target } from "@/lib/targets";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

const ATTACK_SETS = [
  "Prompt Injection",
  "Tool Abuse",
  "Data Exfiltration",
  "Goal Manipulation",
  "Memory Poisoning",
] as const;

const FRIENDLY_SET: Record<string, string> = {
  "Prompt Injection": "Prompt Injection",
  "Tool Abuse": "Tool Abuse",
  "Data Exfiltration": "Data Exfiltration",
  "Goal Manipulation": "Goal Manipulation",
  "Memory Poisoning": "Memory Poisoning",
};

const MATRIX_ROWS = ["Injection", "Tool Abuse", "Exfiltration", "Goal Drift"] as const;
const INTENSITIES = ["Low", "Med", "High"] as const;

type PresetId = "quick" | "standard" | "thorough";
type CampaignPreflight = {
  ready: boolean;
  checks: Array<{ id: string; ready: boolean; message: string }>;
};

const PRESETS: Array<{
  id: PresetId;
  label: string;
  blurb: string;
  iterations: number;
  sets: string[];
  highAll: boolean;
}> = [
  {
    id: "quick",
    label: "Quick",
    blurb: "About 5 rounds — good first pass.",
    iterations: 5,
    sets: ["Prompt Injection", "Tool Abuse"],
    highAll: false,
  },
  {
    id: "standard",
    label: "Standard",
    blurb: "About 10 rounds — balanced coverage.",
    iterations: 10,
    sets: ["Prompt Injection", "Tool Abuse", "Data Exfiltration", "Goal Manipulation"],
    highAll: false,
  },
  {
    id: "thorough",
    label: "Thorough",
    blurb: "About 20 rounds — stronger pressure.",
    iterations: 20,
    sets: [...ATTACK_SETS],
    highAll: true,
  },
];

function buildMatrix(highAll: boolean): Record<string, Record<string, boolean>> {
  const init: Record<string, Record<string, boolean>> = {};
  for (const row of MATRIX_ROWS) {
    init[row] = {
      Low: true,
      Med: true,
      High: highAll || row !== "Goal Drift",
    };
  }
  return init;
}

export default function CampaignBuilderPage() {
  return (
    <Suspense fallback={<p className="text-[13px] text-muted-foreground">Loading campaign…</p>}>
      <CampaignBuilder />
    </Suspense>
  );
}

function CampaignBuilder() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const targetId = searchParams.get("target");
  const [target, setTarget] = useState<Target | null>(null);
  const [preflight, setPreflight] = useState<CampaignPreflight | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(false);
  const [name, setName] = useState("Production Agent Assessment");
  const [preset, setPreset] = useState<PresetId>("standard");
  const [sets, setSets] = useState<string[]>([...PRESETS[1]!.sets]);
  const [matrix, setMatrix] = useState(() => buildMatrix(false));
  const [iterations, setIterations] = useState(10);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [launching, setLaunching] = useState(false);

  const isResearchSource = searchParams.get("source") === "research";
  const researchThreatIds = useMemo(() => {
    const raw = searchParams.get("threat_ids");
    return raw ? raw.split(",").filter(Boolean) : [];
  }, [searchParams]);

  useEffect(() => {
    if (isResearchSource) {
      const customName = searchParams.get("name");
      if (customName) setName(customName);
      const customSets = searchParams.get("sets");
      if (customSets) {
        const matching = ATTACK_SETS.filter((s) =>
          customSets.toLowerCase().includes(s.toLowerCase().slice(0, 4))
        );
        if (matching.length > 0) setSets(matching);
      }
    }
  }, [isResearchSource, searchParams]);

  const categories = useMemo(() => mergeCampaignCategories(sets, matrix), [sets, matrix]);
  const intensity = useMemo(() => intensityFromMatrix(matrix), [matrix]);
  const mut = useMemo(() => mutationsForIntensity(intensity), [intensity]);

  useEffect(() => {
    if (!targetId) {
      setTarget(null);
      return;
    }
    let current = true;
    setTarget(null);
    void fetchFromBackend<Target>(`/api/v1/targets/${encodeURIComponent(targetId)}`, {
      silent: true,
      timeoutMs: 5_000,
    }).then((t) => {
      if (!current || !t) return;
      setTarget(t);
      setName((prev) =>
        prev === "Production Agent Assessment" ? `${t.name} · ${t.version}` : prev
      );
    });
    return () => {
      current = false;
    };
  }, [targetId]);

  useEffect(() => {
    if (!targetId) {
      setPreflight(null);
      setPreflightLoading(false);
      return;
    }
    let current = true;
    setPreflight(null);
    setPreflightLoading(true);
    void fetchFromBackend<CampaignPreflight>(
      `/api/v1/targets/${encodeURIComponent(targetId)}/preflight`,
      { silent: true, timeoutMs: 5_000 }
    ).then((result) => {
      if (current) setPreflight(result);
    }).finally(() => {
      if (current) setPreflightLoading(false);
    });
    return () => {
      current = false;
    };
  }, [targetId]);

  const applyPreset = (id: PresetId) => {
    const p = PRESETS.find((x) => x.id === id)!;
    setPreset(id);
    setSets([...p.sets]);
    setIterations(p.iterations);
    setMatrix(buildMatrix(p.highAll));
  };

  const toggleSet = (s: string) =>
    setSets((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const toggleCell = (row: string, col: string) =>
    setMatrix((prev) => ({
      ...prev,
      [row]: { ...prev[row], [col]: !prev[row]?.[col] },
    }));

  const launch = async () => {
    if (!targetId || !target) {
      toast("Choose a registered target", {
        description: "Campaigns need a target with authorization, provider credentials, and successful discovery.",
        variant: "error",
      });
      return;
    }
    if (categories.length === 0) {
      toast("Pick at least one risk", {
        description: "Choose what you want to test before starting.",
        variant: "error",
      });
      return;
    }
    if (!target.authorized) {
      toast("Target is not authorized", {
        description: "Authorize it on Targets before ARTSA sends it any traffic.",
        variant: "error",
      });
      return;
    }
    if (!target.surface?.reachable) {
      toast("Run discovery first", {
        description: "Campaigns can start after target discovery completes successfully.",
        variant: "error",
      });
      return;
    }
    const currentPreflight = await fetchFromBackend<CampaignPreflight>(
      `/api/v1/targets/${encodeURIComponent(targetId)}/preflight`,
      { silent: true, timeoutMs: 5_000 }
    );
    if (!currentPreflight?.ready) {
      const blockers = currentPreflight?.checks.filter((check) => !check.ready).map((check) => check.message);
      toast("Campaign preflight is not ready", {
        description: blockers?.join(" · ") || "Check target authorization, provider settings, and discovery.",
        variant: "error",
      });
      return;
    }
    setLaunching(true);
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
          ...(targetId ? { target_id: targetId } : {}),
        }),
        timeoutMs: 20_000,
      }
    );
    setLaunching(false);
    if (!res?.campaign_id) {
      toast("Campaign not started", {
        description: "The backend did not start this campaign. Review target and provider readiness, then try again.",
        variant: "error",
      });
      return;
    }
    toast("Campaign launched", {
      description: res.message || "Opening live Monitor…",
      variant: "success",
    });
    router.push(`/red-team/monitor/${res.campaign_id}?follow=1`);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-white">Create campaign</h2>
        <p className="mt-1 max-w-xl text-[13px] text-neutral-400">
          Pick a preset or customize attack sets — then launch and watch rounds in Monitor.
        </p>
      </div>

      {target ? (
        <div className="rounded-lg border border-neutral-800 bg-[#0e0e0e] p-4 text-[13px] shadow-sm">
          <p className="font-medium text-white">
            Target: {target.name}
            <span className="ml-2 font-mono text-[11px] text-neutral-400">
              {kindLabel(target.kind)} · {target.version} · {target.provider}/{target.model}
            </span>
          </p>
          {target.authorized ? (
            <p className="mt-1 text-[12px] text-neutral-400">
              This assessment uses the registered target configuration and stores results against this version.
            </p>
          ) : (
            <p className="mt-1 text-[12px] text-rose-400">
              This target is not authorized. ARTSA will refuse to send it traffic until you
              authorize it on{" "}
              <Link href="/targets" className="text-rose-300 underline underline-offset-2 hover:underline">
                Targets
              </Link>
              .
            </p>
          )}
          <ul aria-label="Campaign preflight" className="mt-3 grid gap-1.5 text-[12px] sm:grid-cols-3">
            {preflightLoading ? <li className="text-neutral-500">Checking readiness…</li> : null}
            {preflight?.checks.map((check) => (
              <li key={check.id} className={check.ready ? "text-emerald-400 font-medium" : "text-amber-400"}>
                {check.ready ? "✓" : "•"} {check.message}
              </li>
            ))}
            {!preflightLoading && !preflight ? (
              <li className="text-amber-400 sm:col-span-3">Could not check campaign readiness. Refresh the target and try again.</li>
            ) : null}
          </ul>
        </div>
      ) : targetId ? (
        <p className="text-[13px] text-neutral-400">Loading target…</p>
      ) : (
        <div className="rounded-lg border border-neutral-800 bg-[#0e0e0e] p-4 text-[12px] text-neutral-400">
          No target selected.{" "}
          <Link href="/targets" className="text-white underline underline-offset-2 hover:text-neutral-300">
            Register, authorize, and discover one
          </Link>{" "}
          before launching a campaign.
        </div>
      )}

      {isResearchSource && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-3.5 flex items-start gap-3">
          <div className="rounded p-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-mono text-[12px] font-bold text-white">
              Curated Threat Assessment Workflow
            </p>
            <p className="mt-0.5 text-[11px] text-neutral-400 font-mono">
              Pre-configured from Threat Intelligence Feeds with {researchThreatIds.length} prioritized attack vector{researchThreatIds.length !== 1 ? "s" : ""}.
              {researchThreatIds.length > 0 && ` Targeted frameworks: ${researchThreatIds.slice(0, 4).join(", ")}.`}
            </p>
          </div>
        </div>
      )}

      <RedTeamSimpleSteps
        steps={[
          { n: 1, title: "Name it", body: "Give the campaign a clear name you’ll recognize later." },
          { n: 2, title: "Choose depth", body: "Quick, Standard, or Thorough — or fine-tune below." },
          { n: 3, title: "Launch", body: "We’ll open Monitor as soon as the campaign starts." },
        ]}
      />

      <section className="space-y-2">
        <label className="block space-y-1 text-[12px]">
          <span className="text-neutral-400 font-medium">Campaign name</span>
          <input
            className="w-full rounded-md border border-neutral-800 bg-[#070707] px-3 py-2 text-[13px] text-white placeholder-neutral-500 focus:border-neutral-600 focus:outline-none"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
      </section>

      <section className="space-y-2">
        <h3 className="text-[12px] font-medium text-neutral-400">How thorough?</h3>
        <div className="grid gap-2 sm:grid-cols-3">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p.id)}
              className={cn(
                "rounded-lg border p-3.5 text-left transition-all",
                preset === p.id
                  ? "border-neutral-500 bg-neutral-900 ring-1 ring-white/15 text-white shadow-sm"
                  : "border-neutral-800 bg-[#0e0e0e] text-neutral-400 hover:border-neutral-700 hover:text-neutral-200"
              )}
            >
              <p className="text-[14px] font-semibold text-white">{p.label}</p>
              <p className="mt-1 text-[12px] text-neutral-400">{p.blurb}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-[12px] font-medium text-neutral-400">What to test</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {ATTACK_SETS.map((s) => (
            <label
              key={s}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 text-[13px] cursor-pointer transition-all",
                sets.includes(s)
                  ? "border-neutral-500 bg-neutral-900/90 text-white shadow-sm"
                  : "border-neutral-800 bg-[#0e0e0e] text-neutral-400 hover:border-neutral-700 hover:text-neutral-300"
              )}
            >
              <input
                type="checkbox"
                className="mt-0.5 rounded border-neutral-700 bg-neutral-800 text-white focus:ring-0"
                checked={sets.includes(s)}
                onChange={() => toggleSet(s)}
              />
              <span>
                <span className="font-semibold text-white">
                  {FRIENDLY_SET[s] ?? FRIENDLY_TECHNIQUE[s]?.label ?? s}
                </span>
                <span className="mt-0.5 block text-[11px] text-neutral-400">
                  {FRIENDLY_TECHNIQUE[s]?.why ?? "Include this risk type in the test."}
                </span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowAdvanced((v) => !v)}
          className="text-neutral-400 hover:text-white hover:bg-neutral-900"
        >
          {showAdvanced ? "Hide advanced options" : "Show advanced options"}
        </Button>
      </div>

      {showAdvanced ? (
        <>
          <section className="space-y-2">
            <h3 className="text-[12px] font-medium text-neutral-400">
              Pressure levels (optional)
            </h3>
            <div className="overflow-x-auto rounded-lg border border-neutral-800 bg-[#0e0e0e]">
              <table className="w-full min-w-[360px] text-left text-[12px]">
                <thead>
                  <tr className="border-b border-neutral-800 bg-[#121212] text-[10px] uppercase tracking-wide text-neutral-400">
                    <th className="px-3 py-2.5 font-medium">Risk</th>
                    {INTENSITIES.map((i) => (
                      <th key={i} className="px-3 py-2.5 font-medium">
                        {i}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MATRIX_ROWS.map((row) => (
                    <tr key={row} className="border-b border-neutral-800/60 last:border-0 hover:bg-neutral-900/40">
                      <td className="px-3 py-2.5 font-medium text-white">{row}</td>
                      {INTENSITIES.map((col) => (
                        <td key={col} className="px-3 py-2.5">
                          <button
                            type="button"
                            onClick={() => toggleCell(row, col)}
                            className={cn(
                              "rounded px-2 py-0.5 font-mono text-[11px] transition-colors",
                              matrix[row]?.[col]
                                ? "bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 font-semibold"
                                : "text-neutral-500 hover:text-neutral-300"
                            )}
                            aria-pressed={matrix[row]?.[col]}
                          >
                            {matrix[row]?.[col] ? "ON" : "OFF"}
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <label className="block max-w-xs space-y-1 text-[12px]">
            <span className="text-neutral-400 font-medium">How many rounds</span>
            <input
              type="number"
              min={1}
              max={100}
              className="w-full rounded-md border border-neutral-800 bg-[#070707] px-3 py-2 text-[13px] text-white focus:border-neutral-600 focus:outline-none"
              value={iterations}
              onChange={(e) => {
                const n = Number(e.target.value);
                setIterations(Number.isFinite(n) ? Math.max(1, Math.min(100, n)) : 1);
              }}
            />
          </label>
        </>
      ) : (
        <p className="text-[12px] text-neutral-400">
          This preset runs about {iterations} rounds
          {categories.length ? ` across ${categories.length} risk areas` : ""}.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Button variant="outline" size="sm" asChild className="border-neutral-800 bg-[#0e0e0e] text-neutral-300 hover:bg-neutral-800 hover:text-white">
          <Link href="/red-team/campaigns">Back</Link>
        </Button>
        <Button size="sm" variant="outline" asChild className="border-neutral-800 bg-[#0e0e0e] text-neutral-300 hover:bg-neutral-800 hover:text-white">
          <Link href="/red-team/lab">Attack Lab</Link>
        </Button>
        <Button
          size="sm"
          onClick={() => void launch()}
          disabled={launching || preflightLoading || !preflight?.ready || categories.length === 0 || !targetId || !target}
          className="bg-white text-black font-semibold hover:bg-neutral-200 disabled:opacity-40 disabled:hover:bg-white"
        >
          {launching ? "Launching…" : "Launch campaign"}
        </Button>
      </div>
    </div>
  );
}
