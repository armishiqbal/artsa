"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { LandingMotionCard } from "@/components/landing/LandingMotionCard";
import { easeOut, fadeUp, staggerContainer } from "@/lib/motionPresets";
import { cn } from "@/lib/utils";

type Posture = "strong" | "mixed" | "weak" | "unknown";

export type CohortHeroModel = {
  n: number;
  running: number;
  completed: number;
  failed: number;
  meanRisk: number | null;
  maxRisk: number;
  detectPct: number | null;
  critical: number;
  assessmentCount: number;
  labCount: number;
  finding: string;
  posture: Posture;
  /** Sorted risk samples for spark (0–100). */
  riskSpark: number[];
};

/** Analytical cohort header — finding + toned KPIs + mix strip (ARTSA live blue / green / red). */
export function CampaignCohortHero({ model }: { model: CohortHeroModel }) {
  const {
    n,
    running,
    completed,
    failed,
    meanRisk,
    maxRisk,
    detectPct,
    critical,
    assessmentCount,
    labCount,
    finding,
    posture,
    riskSpark,
  } = model;

  const assessShare = n > 0 ? Math.round((assessmentCount / n) * 100) : 0;
  const labShare = n > 0 ? Math.round((labCount / n) * 100) : 0;
  const meanPct = meanRisk != null ? Math.min(100, meanRisk) : 0;
  const maxPct = Math.min(100, maxRisk);

  return (
    <div className="space-y-4">
      {/* Finding + spark */}
      <LandingMotionCard
        index={0}
        glow={false}
        className={cn(
          "overflow-hidden border p-4 sm:p-5",
          posture === "weak" &&
            "border-[hsl(var(--severity-critical-border))] bg-[hsl(var(--severity-critical-subtle))]",
          posture === "mixed" &&
            "border-[hsl(var(--severity-medium-border))] bg-[hsl(var(--severity-medium-subtle))]",
          posture === "strong" &&
            "border-[hsl(var(--severity-low-border))] bg-[hsl(var(--severity-low-subtle))]",
          posture === "unknown" && "border-border bg-card"
        )}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-6">
          <div
            className={cn(
              "hidden w-1 shrink-0 rounded-full lg:block",
              posture === "weak" && "bg-[hsl(var(--severity-critical))]",
              posture === "mixed" && "bg-[hsl(var(--severity-medium))]",
              posture === "strong" && "bg-[hsl(var(--severity-low))]",
              posture === "unknown" && "bg-muted-foreground/40"
            )}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Cohort finding
              </p>
              <PosturePill posture={posture} />
              {running > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-sm border border-[hsl(var(--severity-info-border))] bg-[hsl(var(--severity-info-subtle))] px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inset-0 animate-ping rounded-full bg-primary/50" />
                    <span className="relative h-1.5 w-1.5 rounded-full bg-primary" />
                  </span>
                  {running} live
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-[15px] leading-relaxed text-foreground">{finding}</p>
            <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
              <Link href="/red-team/matrix" className="underline-offset-2 hover:text-foreground hover:underline">
                Outcomes
              </Link>
              <span aria-hidden>·</span>
              <Link href="/red-team/graph" className="underline-offset-2 hover:text-foreground hover:underline">
                Attack Graph
              </Link>
              {running > 0 ? (
                <>
                  <span aria-hidden>·</span>
                  <span className="font-medium text-primary">Watch orbit for live nodes</span>
                </>
              ) : null}
            </div>
          </div>

          {/* Risk spark — mini analytical strip */}
          <div className="w-full shrink-0 rounded-md border border-border bg-card p-3 shadow-sm lg:w-[200px]">
            <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              Risk spark · launches
            </p>
            <div className="mt-2 flex h-14 items-end gap-0.5 rounded-sm bg-muted/60 px-1 py-1">
              {(riskSpark.length ? riskSpark : [0]).slice(0, 24).map((r, i) => {
                const h = Math.max(8, Math.round((r / 100) * 48));
                const tone =
                  r >= 80
                    ? "bg-[hsl(var(--severity-critical))]"
                    : r >= 60
                      ? "bg-[hsl(var(--severity-high))]"
                      : r >= 40
                        ? "bg-[hsl(var(--severity-medium))]"
                        : "bg-[hsl(var(--severity-low))]";
                return (
                  <motion.span
                    key={`${i}-${r}`}
                    className={cn("min-w-[3px] flex-1 rounded-sm", tone)}
                    initial={{ height: 4, opacity: 0.4 }}
                    animate={{ height: h, opacity: 1 }}
                    transition={{ delay: i * 0.02, duration: 0.4, ease: easeOut }}
                    title={`R${r}`}
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
          </div>
        </div>
      </LandingMotionCard>

      {/* Primary KPIs */}
      <motion.div
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        <Kpi
          label="n"
          value={String(n)}
          hint="Cohort size"
          bar={100}
          tone="neutral"
        />
        <Kpi
          label="Running"
          value={String(running)}
          hint="Live theaters"
          bar={n ? (running / n) * 100 : 0}
          tone="live"
        />
        <Kpi
          label="Completed"
          value={String(completed)}
          hint="Finished runs"
          bar={n ? (completed / n) * 100 : 0}
          tone="ok"
        />
        <Kpi
          label="μ risk"
          value={meanRisk != null ? String(meanRisk) : "—"}
          hint="Mean score"
          bar={meanPct}
          tone={meanRisk != null && meanRisk >= 80 ? "critical" : meanRisk != null && meanRisk >= 60 ? "warn" : "neutral"}
        />
        <Kpi
          label="Detect %"
          value={detectPct != null ? `${detectPct}%` : "—"}
          hint="Contain rate"
          bar={detectPct ?? 0}
          tone={
            detectPct == null
              ? "neutral"
              : detectPct >= 80
                ? "ok"
                : detectPct >= 50
                  ? "warn"
                  : "critical"
          }
        />
        <Kpi
          label="Critical"
          value={String(critical)}
          hint="Hot signals"
          bar={n ? Math.min(100, (critical / n) * 100) : 0}
          tone={critical > 0 ? "critical" : "neutral"}
        />
      </motion.div>

      {/* Composition + peak */}
      <motion.div
        className="grid gap-2 sm:grid-cols-3"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={fadeUp} transition={{ ease: easeOut }}>
          <LandingMotionCard index={1} className="h-full p-3.5" glow={false}>
            <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              Assessments
            </p>
            <p className="mt-1 font-mono text-[22px] font-semibold tabular-nums text-foreground">
              {assessmentCount}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Named campaign runs · {assessShare}%</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full bg-foreground/55"
                initial={{ width: 0 }}
                animate={{ width: `${assessShare}%` }}
                transition={{ duration: 0.55, ease: easeOut }}
              />
            </div>
          </LandingMotionCard>
        </motion.div>

        <motion.div variants={fadeUp} transition={{ ease: easeOut }}>
          <LandingMotionCard
            index={2}
            className="h-full border-[hsl(var(--severity-info-border))] bg-[hsl(var(--severity-info-subtle))] p-3.5"
            glow={false}
          >
            <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              Lab experiments
            </p>
            <p className="mt-1 font-mono text-[22px] font-semibold tabular-nums text-primary">
              {labCount}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">From Attack Lab · {labShare}%</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${labShare}%` }}
                transition={{ duration: 0.55, ease: easeOut }}
              />
            </div>
          </LandingMotionCard>
        </motion.div>

        <motion.div variants={fadeUp} transition={{ ease: easeOut }}>
          <LandingMotionCard
            index={3}
            className={cn(
              "h-full p-3.5",
              maxRisk >= 80 && "ring-1 ring-[hsl(var(--severity-critical))]/35"
            )}
            glow={false}
          >
            <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              Max risk
            </p>
            <p
              className={cn(
                "mt-1 font-mono text-[22px] font-semibold tabular-nums",
                maxRisk >= 80
                  ? "text-[hsl(var(--severity-critical))]"
                  : maxRisk >= 60
                    ? "text-[hsl(var(--severity-high))]"
                    : "text-foreground"
              )}
            >
              {maxRisk > 0 ? `R${maxRisk}` : "—"}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Peak in cohort · vs μ {meanRisk ?? "—"}
            </p>
            <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <motion.div
                className={cn(
                  "h-full rounded-full",
                  maxRisk >= 80
                    ? "bg-[hsl(var(--severity-critical))]"
                    : maxRisk >= 60
                      ? "bg-[hsl(var(--severity-high))]"
                      : "bg-[hsl(var(--severity-low))]"
                )}
                initial={{ width: 0 }}
                animate={{ width: `${maxPct}%` }}
                transition={{ duration: 0.55, ease: easeOut }}
              />
              {meanRisk != null ? (
                <span
                  className="absolute top-1/2 h-2.5 w-0.5 -translate-y-1/2 bg-foreground/80"
                  style={{ left: `${meanPct}%` }}
                  title={`μ ${meanRisk}`}
                />
              ) : null}
            </div>
          </LandingMotionCard>
        </motion.div>
      </motion.div>

      {/* Failed note if any */}
      {failed > 0 ? (
        <p className="font-mono text-[11px] text-[hsl(var(--severity-critical))]">
          {failed} failed / cancelled in cohort — filter Failed in the table below.
        </p>
      ) : null}
    </div>
  );
}

function PosturePill({ posture }: { posture: Posture }) {
  return (
    <span
      className={cn(
        "rounded-sm border px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider",
        posture === "strong" &&
          "border-[hsl(var(--severity-low-border))] bg-[hsl(var(--severity-low-subtle))] text-[hsl(var(--severity-low))]",
        posture === "mixed" &&
          "border-[hsl(var(--severity-medium-border))] bg-[hsl(var(--severity-medium-subtle))] text-[hsl(var(--severity-medium))]",
        posture === "weak" &&
          "border-[hsl(var(--severity-critical-border))] bg-[hsl(var(--severity-critical-subtle))] text-[hsl(var(--severity-critical))]",
        posture === "unknown" && "border-border bg-muted text-muted-foreground"
      )}
    >
      {posture}
    </span>
  );
}

function Kpi({
  label,
  value,
  hint,
  bar,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  bar: number;
  tone: "live" | "ok" | "warn" | "critical" | "neutral";
}) {
  const barClass =
    tone === "live"
      ? "bg-primary"
      : tone === "ok"
        ? "bg-[hsl(var(--severity-low))]"
        : tone === "warn"
          ? "bg-[hsl(var(--severity-medium))]"
          : tone === "critical"
            ? "bg-[hsl(var(--severity-critical))]"
            : "bg-foreground/50";

  const valueClass =
    tone === "live"
      ? "text-primary"
      : tone === "ok"
        ? "text-[hsl(var(--severity-low))]"
        : tone === "warn"
          ? "text-[hsl(var(--severity-medium))]"
          : tone === "critical"
            ? "text-[hsl(var(--severity-critical))]"
            : "text-foreground";

  return (
    <motion.div variants={fadeUp} transition={{ ease: easeOut }}>
      <LandingMotionCard
        index={0}
        glow={false}
        className={cn(
          "h-full border p-3",
          tone === "live" &&
            "border-[hsl(var(--severity-info-border))] bg-[hsl(var(--severity-info-subtle))]",
          tone === "ok" &&
            "border-[hsl(var(--severity-low-border))] bg-[hsl(var(--severity-low-subtle))]",
          tone === "warn" &&
            "border-[hsl(var(--severity-medium-border))] bg-[hsl(var(--severity-medium-subtle))]",
          tone === "critical" &&
            "border-[hsl(var(--severity-critical-border))] bg-[hsl(var(--severity-critical-subtle))]",
          tone === "neutral" && "border-border bg-card"
        )}
      >
        <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={cn("mt-0.5 font-mono text-[20px] font-semibold tabular-nums", valueClass)}>
          {value}
        </p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>
        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-background/80 dark:bg-muted">
          <motion.div
            className={cn("h-full rounded-full", barClass)}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, Math.max(0, bar))}%` }}
            transition={{ duration: 0.5, ease: easeOut }}
          />
        </div>
      </LandingMotionCard>
    </motion.div>
  );
}
