"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { LandingMotionCard } from "@/components/landing/LandingMotionCard";
import {
  type LabCatalogCoverageRow,
  type LabRiskPart,
  type LabStrategy,
  type LabStrategyCompareRow,
  type LabTechniqueId,
} from "@/lib/attackLab";
import { easeOut, fadeUp, staggerContainer } from "@/lib/motionPresets";
import { cn } from "@/lib/utils";

const STACK_COLORS = [
  "bg-foreground/70",
  "bg-primary",
  "bg-[hsl(var(--severity-medium))]",
  "bg-[hsl(var(--severity-high))]",
  "bg-[hsl(var(--severity-info))]",
];

type Props = {
  composition: LabRiskPart[];
  estimatedRisk: number;
  strategyRows: LabStrategyCompareRow[];
  activeStrategy: LabStrategy;
  onPickStrategy: (s: LabStrategy) => void;
  onProbeStrategy: (s: LabStrategy) => void;
  coverage: LabCatalogCoverageRow[];
  activeTechnique: LabTechniqueId;
  onPickTechnique: (id: LabTechniqueId) => void;
  onProbeTechnique: (id: LabTechniqueId) => void;
  nextTarget: LabCatalogCoverageRow | null;
  riskSpark: number[];
  meanRisk: number | null;
  maxRisk: number;
  probing: boolean;
};

/** Analytical floor under experiment design — composition, strategy matrix, catalog coverage. */
export function AttackLabAnalysis({
  composition,
  estimatedRisk,
  strategyRows,
  activeStrategy,
  onPickStrategy,
  onProbeStrategy,
  coverage,
  activeTechnique,
  onPickTechnique,
  onProbeTechnique,
  nextTarget,
  riskSpark,
  meanRisk,
  maxRisk,
  probing,
}: Props) {
  const coveredCount = coverage.filter((r) => r.covered).length;
  const coverPct = Math.round((coveredCount / Math.max(1, coverage.length)) * 100);
  const totalParts = composition.reduce((a, p) => a + p.points, 0) || 1;

  return (
    <motion.div
      className="space-y-4"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Lab analysis
        </h3>
        <p className="font-mono text-[10px] text-muted-foreground">
          Pre-run estimates · not live scores
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {/* Risk composition */}
        <motion.div variants={fadeUp} transition={{ ease: easeOut }}>
          <LandingMotionCard index={0} glow={false} className="h-full border border-border bg-card p-4">
            <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              Risk composition · estimate
            </p>
            <p className="mt-1 font-mono text-[22px] font-semibold tabular-nums text-foreground">
              R{estimatedRisk}
            </p>
            <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-muted">
              {composition.map((p, i) => (
                <motion.span
                  key={p.id}
                  className={cn("h-full", STACK_COLORS[i % STACK_COLORS.length])}
                  title={`${p.label}: ${p.points}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${(p.points / totalParts) * 100}%` }}
                  transition={{ duration: 0.5, delay: i * 0.05, ease: easeOut }}
                />
              ))}
            </div>
            <ul className="mt-3 space-y-1.5">
              {composition.map((p, i) => (
                <li key={p.id} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span
                      className={cn("h-1.5 w-1.5 rounded-full", STACK_COLORS[i % STACK_COLORS.length])}
                      aria-hidden
                    />
                    {p.label}
                  </span>
                  <span className="font-mono tabular-nums text-foreground">+{p.points}</span>
                </li>
              ))}
            </ul>
          </LandingMotionCard>
        </motion.div>

        {/* Prior risk spark */}
        <motion.div variants={fadeUp} transition={{ ease: easeOut }}>
          <LandingMotionCard index={1} glow={false} className="h-full border border-border bg-card p-4">
            <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              Prior risk · this technique
            </p>
            <div className="mt-3 flex h-16 items-end gap-0.5 rounded-sm bg-muted/60 px-1 py-1">
              {(riskSpark.length ? riskSpark : [0]).slice(0, 16).map((r, i) => {
                const h = Math.max(6, Math.round((r / 100) * 56));
                const tone =
                  r >= 80
                    ? "bg-[hsl(var(--severity-critical))]"
                    : r >= 60
                      ? "bg-[hsl(var(--severity-high))]"
                      : r >= 40
                        ? "bg-[hsl(var(--severity-medium))]"
                        : r > 0
                          ? "bg-[hsl(var(--severity-low))]"
                          : "bg-muted-foreground/25";
                return (
                  <motion.span
                    key={`${i}-${r}`}
                    className={cn("min-w-[4px] flex-1 rounded-sm", tone)}
                    initial={{ height: 4, opacity: 0.4 }}
                    animate={{ height: h, opacity: 1 }}
                    transition={{ delay: i * 0.025, duration: 0.35, ease: easeOut }}
                    title={r ? `R${r}` : "—"}
                  />
                );
              })}
            </div>
            <div className="mt-2 flex justify-between font-mono text-[10px] tabular-nums text-muted-foreground">
              <span>μ {meanRisk ?? "—"}</span>
              <span
                className={cn(
                  maxRisk >= 80 && "font-semibold text-[hsl(var(--severity-critical))]"
                )}
              >
                max {maxRisk > 0 ? maxRisk : "—"}
              </span>
            </div>
            {!riskSpark.length ? (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Launch experiments to populate this spark from API scores.
              </p>
            ) : null}
          </LandingMotionCard>
        </motion.div>

        {/* Catalog coverage */}
        <motion.div variants={fadeUp} transition={{ ease: easeOut }}>
          <LandingMotionCard
            index={2}
            glow={false}
            className="h-full border border-[hsl(var(--severity-info-border))] bg-[hsl(var(--severity-info-subtle))] p-4"
          >
            <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              Catalog coverage
            </p>
            <p className="mt-1 font-mono text-[22px] font-semibold tabular-nums text-primary">
              {coveredCount}/{coverage.length}
            </p>
            <p className="text-[11px] text-muted-foreground">{coverPct}% techniques with lab runs</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${coverPct}%` }}
                transition={{ duration: 0.55, ease: easeOut }}
              />
            </div>
            {nextTarget ? (
              <div className="mt-3 space-y-1.5">
                <button
                  type="button"
                  onClick={() => onPickTechnique(nextTarget.id)}
                  className="w-full rounded-md border border-border bg-card/80 px-2.5 py-2 text-left transition-colors hover:border-primary/40"
                >
                  <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    Suggested next
                  </p>
                  <p className="mt-0.5 text-[12px] font-medium text-foreground">{nextTarget.id}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    R{nextTarget.baseRisk} ·{" "}
                    {nextTarget.runs === 0 ? "uncovered" : `${nextTarget.runs} runs`}
                  </p>
                </button>
                <button
                  type="button"
                  disabled={probing}
                  onClick={() => onProbeTechnique(nextTarget.id)}
                  className="w-full rounded-sm border border-primary/40 bg-card py-1.5 font-mono text-[10px] text-primary disabled:opacity-50"
                >
                  {probing ? "Probing…" : "Select & probe"}
                </button>
              </div>
            ) : (
              <p className="mt-3 text-[11px] text-muted-foreground">
                Catalog fully probed — raise n or stress presets.
              </p>
            )}
          </LandingMotionCard>
        </motion.div>
      </div>

      {/* Strategy compare */}
      <LandingMotionCard index={3} glow={false} className="overflow-hidden border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            Strategy matrix · pre-run estimates
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Planning pressure vs expected detect — run a check for a live score.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-border font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2 font-medium">Strategy</th>
                <th className="px-4 py-2 font-medium">Boost</th>
                <th className="px-4 py-2 font-medium">Est. risk</th>
                <th className="px-4 py-2 font-medium">Est. detect</th>
                <th className="px-4 py-2 font-medium">Posture</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {strategyRows.map((row) => {
                const active = row.strategy === activeStrategy;
                return (
                  <tr
                    key={row.strategy}
                    className={cn(
                      "border-b border-border/60 last:border-0",
                      active && "bg-[hsl(var(--severity-info-subtle))]"
                    )}
                  >
                    <td className="px-4 py-2.5 font-medium text-foreground">{row.strategy}</td>
                    <td className="px-4 py-2.5 font-mono tabular-nums text-muted-foreground">
                      {row.boost > 0 ? `+${row.boost}` : "0"}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "font-mono tabular-nums",
                            row.estimatedRisk >= 80
                              ? "text-[hsl(var(--severity-critical))]"
                              : "text-foreground"
                          )}
                        >
                          R{row.estimatedRisk}
                        </span>
                        <span className="h-1 w-12 overflow-hidden rounded-full bg-muted">
                          <span
                            className={cn(
                              "block h-full rounded-full",
                              row.estimatedRisk >= 80
                                ? "bg-[hsl(var(--severity-critical))]"
                                : row.estimatedRisk >= 60
                                  ? "bg-[hsl(var(--severity-medium))]"
                                  : "bg-[hsl(var(--severity-low))]"
                            )}
                            style={{ width: `${row.estimatedRisk}%` }}
                          />
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-mono tabular-nums text-foreground">
                      {row.estimatedDetectPct}%
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          "rounded-sm border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider",
                          row.posture === "aggressive" &&
                            "border-[hsl(var(--severity-critical-border))] text-[hsl(var(--severity-critical))]",
                          row.posture === "standard" &&
                            "border-[hsl(var(--severity-medium-border))] text-[hsl(var(--severity-medium))]",
                          row.posture === "exploratory" &&
                            "border-[hsl(var(--severity-low-border))] text-[hsl(var(--severity-low))]"
                        )}
                      >
                        {row.posture}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onPickStrategy(row.strategy)}
                          className={cn(
                            "text-[11px] underline-offset-2 hover:underline",
                            active ? "font-medium text-primary" : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {active ? "Selected" : "Use"}
                        </button>
                        <button
                          type="button"
                          disabled={probing}
                          onClick={() => onProbeStrategy(row.strategy)}
                          className="text-[11px] font-medium text-primary underline-offset-2 hover:underline disabled:opacity-50"
                        >
                          {probing ? "…" : "Probe"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </LandingMotionCard>

      {/* Technique coverage grid */}
      <LandingMotionCard index={4} glow={false} className="border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            Technique × history
          </p>
          <Link
            href="/red-team/campaigns"
            className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            All campaigns
          </Link>
        </div>
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {coverage.map((row) => {
            const active = row.id === activeTechnique;
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => onPickTechnique(row.id)}
                className={cn(
                  "rounded-md border px-2 py-2 text-left transition-colors",
                  active && "ring-1 ring-primary/40",
                  row.covered
                    ? "border-[hsl(var(--severity-low-border))] bg-[hsl(var(--severity-low-subtle))]"
                    : "border-border bg-muted/20 hover:border-foreground/20",
                  !row.covered && row.baseRisk >= 78 && "border-[hsl(var(--severity-critical-border))]/50"
                )}
              >
                <p className="truncate text-[11px] font-medium text-foreground">{row.id}</p>
                <p className="mt-0.5 font-mono text-[9px] text-muted-foreground">
                  {row.owasp} · {row.covered ? `${row.runs} run${row.runs === 1 ? "" : "s"}` : "gap"}
                </p>
                {row.meanRisk != null ? (
                  <p className="font-mono text-[10px] tabular-nums text-foreground">μ R{row.meanRisk}</p>
                ) : (
                  <p className="font-mono text-[10px] text-muted-foreground">—</p>
                )}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onProbeTechnique(row.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      onProbeTechnique(row.id);
                    }
                  }}
                  className="mt-1 inline-block font-mono text-[9px] text-primary underline-offset-2 hover:underline"
                >
                  {probing ? "…" : "Probe"}
                </span>
              </button>
            );
          })}
        </div>
      </LandingMotionCard>
    </motion.div>
  );
}
