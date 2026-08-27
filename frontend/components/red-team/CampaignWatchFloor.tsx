"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { LandingMotionCard } from "@/components/landing/LandingMotionCard";
import { riskScoreFromSummary } from "@/lib/assessmentResults";
import type { CampaignListItem } from "@/lib/hooks/useCampaigns";
import { easeOut, fadeUp, staggerContainer } from "@/lib/motionPresets";
import { cn } from "@/lib/utils";

function bucket(status: string): "running" | "completed" | "failed" | "other" {
  const s = status.toUpperCase();
  if (s === "RUNNING" || s === "PENDING") return "running";
  if (s === "COMPLETED") return "completed";
  if (s === "FAILED" || s === "ERROR" || s === "CANCELLED") return "failed";
  return "other";
}

type OrbitNode = {
  id: string;
  name: string;
  status: string;
  provider: string;
  model: string;
  risk: number;
  band: "low" | "med" | "high" | "critical";
  live: boolean;
  failed: boolean;
  done: boolean;
  lab: boolean;
  progress: number;
  rounds: string;
  angle: number;
  radiusPct: number;
  size: number;
  href: string;
};

function riskBand(risk: number): OrbitNode["band"] {
  if (risk >= 80) return "critical";
  if (risk >= 60) return "high";
  if (risk >= 40) return "med";
  return "low";
}

/** Polar encoding: angle = status sector, radius = risk, size = progress. */
function buildOrbit(campaigns: CampaignListItem[]): OrbitNode[] {
  const groups: Record<"running" | "completed" | "failed" | "other", CampaignListItem[]> = {
    running: [],
    completed: [],
    failed: [],
    other: [],
  };
  for (const c of campaigns.slice(0, 18)) {
    groups[bucket(c.status)].push(c);
  }

  // Sector centers (radians): live top-right, done bottom, failed top-left
  const sectors: Array<{
    key: keyof typeof groups;
    start: number;
    end: number;
  }> = [
    { key: "running", start: -Math.PI * 0.85, end: -Math.PI * 0.15 },
    { key: "completed", start: Math.PI * 0.15, end: Math.PI * 0.85 },
    { key: "failed", start: Math.PI * 0.95, end: Math.PI * 1.65 },
    { key: "other", start: -Math.PI * 0.1, end: Math.PI * 0.1 },
  ];

  const nodes: OrbitNode[] = [];
  for (const sec of sectors) {
    const list = groups[sec.key];
    list.forEach((c, i) => {
      const b = bucket(c.status);
      const risk =
        riskScoreFromSummary(c.summary ?? null) ??
        (b === "failed" ? 72 : b === "running" ? 55 : 28);
      const total = Math.max(1, Number(c.total_rounds || 1));
      const done = Number(c.rounds_completed || 0);
      const progress = Math.min(1, done / total);
      const t = list.length === 1 ? 0.5 : i / (list.length - 1);
      const angle = sec.start + (sec.end - sec.start) * t;
      // Map risk 0–100 → 28%–48% from center (leaves core clear)
      const radiusPct = 28 + (Math.min(100, risk) / 100) * 20;
      const size = 10 + progress * 8 + (b === "running" ? 2 : 0);
      nodes.push({
        id: c.id,
        name: c.name,
        status: c.status,
        provider: c.provider,
        model: c.model,
        risk: Math.round(risk),
        band: riskBand(risk),
        live: b === "running",
        failed: b === "failed",
        done: b === "completed",
        lab: String(c.name || "").startsWith("Lab ·"),
        progress,
        rounds: `${done}/${c.total_rounds}`,
        angle,
        radiusPct,
        size,
        href: `/red-team/monitor/${c.id}${b === "running" ? "?follow=1" : ""}`,
      });
    });
  }
  return nodes;
}

function orbitStats(nodes: OrbitNode[], nAll: number) {
  const risks = nodes.map((n) => n.risk);
  const mean = risks.length
    ? Math.round((risks.reduce((a, b) => a + b, 0) / risks.length) * 10) / 10
    : null;
  const byBand = {
    low: nodes.filter((n) => n.band === "low").length,
    med: nodes.filter((n) => n.band === "med").length,
    high: nodes.filter((n) => n.band === "high").length,
    critical: nodes.filter((n) => n.band === "critical").length,
  };
  const live = nodes.filter((n) => n.live).length;
  const failed = nodes.filter((n) => n.failed).length;
  const lab = nodes.filter((n) => n.lab).length;
  const max = risks.length ? Math.max(...risks) : 0;
  const finding =
    live > 0
      ? `${live} engagement(s) live on the field — watch mid-risk ring for drift.`
      : failed / Math.max(1, nodes.length) >= 0.5
        ? `Failure-heavy cohort (${failed}/${nodes.length}). Outer ring is dense — re-check targets and intensity.`
        : byBand.critical > 0
          ? `${byBand.critical} critical-risk launch(es). Prioritize theaters on the outer ring.`
          : `Stable field · μ risk ${mean ?? "—"} · n=${nAll}. Outer = hotter.`;
  return { mean, byBand, live, failed, lab, max, finding };
}

/** Analytical campaign orbit — polar risk × status, motion cards. */
export function CampaignWatchFloor({ campaigns }: { campaigns: CampaignListItem[] }) {
  const orbit = useMemo(() => buildOrbit(campaigns), [campaigns]);
  const stats = useMemo(() => orbitStats(orbit, campaigns.length), [orbit, campaigns.length]);
  const [focusId, setFocusId] = useState<string | null>(null);

  const focus =
    orbit.find((n) => n.id === focusId) ??
    orbit.find((n) => n.live) ??
    [...orbit].sort((a, b) => b.risk - a.risk)[0] ??
    null;

  const running = campaigns.filter((c) => bucket(c.status) === "running");
  const watchList =
    running.length > 0
      ? running.slice(0, 6)
      : [...campaigns]
          .map((c) => ({ c, risk: riskScoreFromSummary(c.summary ?? null) ?? 0 }))
          .sort((a, b) => b.risk - a.risk)
          .slice(0, 6)
          .map((x) => x.c);

  if (campaigns.length === 0) {
    return (
      <LandingMotionCard index={0} className="flex h-44 items-center justify-center p-6">
        <p className="text-[13px] text-muted-foreground">
          Orbit empty — launch a campaign and it lands as a polar node (risk × status).
        </p>
      </LandingMotionCard>
    );
  }

  return (
    <div className="space-y-5">
      <LandingMotionCard index={0} className="overflow-hidden border border-border bg-card p-4 sm:p-5" glow={false}>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="max-w-xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Campaign orbit · polar analysis
            </p>
            <p className="mt-1 text-[14px] leading-snug text-foreground">
              <span className="text-muted-foreground">Angle</span> = status sector ·{" "}
              <span className="text-muted-foreground">Radius</span> = risk ·{" "}
              <span className="text-muted-foreground">Size</span> = round progress
            </p>
          </div>
          <p className="font-mono text-[11px] text-muted-foreground">
            field n={orbit.length}
            {campaigns.length > orbit.length ? ` / ${campaigns.length}` : ""}
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_240px]">
          {/* Field */}
          <div className="relative mx-auto aspect-square w-full max-w-[440px]">
            {/* Risk band rings + labels */}
            {(
              [
                { inset: "6%", tone: "border-[hsl(var(--severity-critical-border))]/50" },
                { inset: "16%", tone: "border-[hsl(var(--severity-high-border))]/45" },
                { inset: "26%", tone: "border-[hsl(var(--severity-medium-border))]/45" },
                { inset: "36%", tone: "border-border" },
              ] as const
            ).map((ring) => (
              <div
                key={ring.inset}
                className={cn("pointer-events-none absolute rounded-full border", ring.tone)}
                style={{ inset: ring.inset }}
              />
            ))}

            {/* Sector guides */}
            <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
              <line
                x1="50%"
                y1="50%"
                x2="88%"
                y2="22%"
                stroke="currentColor"
                strokeOpacity="0.12"
                strokeDasharray="3 4"
              />
              <line
                x1="50%"
                y1="50%"
                x2="50%"
                y2="92%"
                stroke="currentColor"
                strokeOpacity="0.12"
                strokeDasharray="3 4"
              />
              <line
                x1="50%"
                y1="50%"
                x2="12%"
                y2="28%"
                stroke="currentColor"
                strokeOpacity="0.12"
                strokeDasharray="3 4"
              />
            </svg>

            <p className="pointer-events-none absolute right-[6%] top-[14%] font-mono text-[9px] uppercase tracking-wider text-primary">
              Live
            </p>
            <p className="pointer-events-none absolute bottom-[6%] left-1/2 -translate-x-1/2 font-mono text-[9px] uppercase tracking-wider text-[hsl(var(--severity-low))]">
              Contained
            </p>
            <p className="pointer-events-none absolute left-[6%] top-[16%] font-mono text-[9px] uppercase tracking-wider text-[hsl(var(--severity-critical))]">
              Failed
            </p>

            {/* Sweep */}
            <motion.div
              className="pointer-events-none absolute inset-[6%] rounded-full"
              style={{
                background:
                  "conic-gradient(from 0deg, transparent 0deg, hsl(var(--primary) / 0.22) 24deg, transparent 48deg)",
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
              aria-hidden
            />

            {/* Core */}
            <div className="absolute left-1/2 top-1/2 z-[1] flex h-[4.5rem] w-[4.5rem] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-border bg-card shadow-md">
              <span className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground">
                μ risk
              </span>
              <span className="font-mono text-[17px] font-semibold tabular-nums text-foreground">
                {stats.mean ?? "—"}
              </span>
              <span className="font-mono text-[8px] text-muted-foreground">n={campaigns.length}</span>
            </div>

            {/* Mean-risk ghost ring */}
            {stats.mean != null ? (
              <div
                className="pointer-events-none absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-primary/35"
                style={{
                  width: `${(28 + (stats.mean / 100) * 20) * 2}%`,
                  height: `${(28 + (stats.mean / 100) * 20) * 2}%`,
                }}
                title={`μ risk ring R${stats.mean}`}
              />
            ) : null}

            {orbit.map((n, i) => {
              const x = 50 + Math.cos(n.angle) * n.radiusPct;
              const y = 50 + Math.sin(n.angle) * n.radiusPct;
              const active = focus?.id === n.id;
              return (
                <motion.div
                  key={n.id}
                  className="absolute z-[2] -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${x}%`, top: `${y}%` }}
                  initial={{ opacity: 0, scale: 0.3 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.05 + i * 0.03, duration: 0.4, ease: easeOut }}
                >
                  <button
                    type="button"
                    onMouseEnter={() => setFocusId(n.id)}
                    onFocus={() => setFocusId(n.id)}
                    onClick={() => setFocusId(n.id)}
                    className="group relative block"
                    aria-label={`${n.name}, risk ${n.risk}, ${n.status}`}
                  >
                    <motion.span
                      className={cn(
                        "block rounded-full border-2",
                        n.live && "border-primary bg-primary",
                        n.failed &&
                          !n.live &&
                          "border-[hsl(var(--severity-critical))] bg-[hsl(var(--severity-critical))]",
                        n.done &&
                          "border-[hsl(var(--severity-low))] bg-[hsl(var(--severity-low))]",
                        !n.live &&
                          !n.failed &&
                          !n.done &&
                          "border-muted-foreground/50 bg-muted-foreground/40",
                        active && "ring-2 ring-foreground/40 ring-offset-1 ring-offset-background"
                      )}
                      style={{ width: n.size, height: n.size }}
                      animate={
                        n.live
                          ? {
                              scale: [1, 1.35, 1],
                              boxShadow: [
                                "0 0 0 0 hsl(var(--primary) / 0.4)",
                                "0 0 0 8px hsl(var(--primary) / 0)",
                                "0 0 0 0 hsl(var(--primary) / 0.4)",
                              ],
                            }
                          : { scale: active ? 1.15 : 1 }
                      }
                      transition={
                        n.live
                          ? { duration: 1.85, repeat: Infinity, ease: "easeInOut" }
                          : { duration: 0.2 }
                      }
                    />
                    {n.lab ? (
                      <span className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-primary" />
                    ) : null}
                  </button>
                </motion.div>
              );
            })}
          </div>

          {/* Analyst panel */}
          <aside className="flex flex-col gap-3 lg:self-center">
            <div className="rounded-md border border-border bg-card px-3 py-2.5 shadow-sm">
              <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                Field reading
              </p>
              <p className="mt-1.5 text-[12px] leading-relaxed text-foreground">{stats.finding}</p>
            </div>

            <dl className="grid grid-cols-2 gap-2">
              <Metric k="Live" v={String(stats.live)} tone={stats.live > 0 ? "live" : "neutral"} />
              <Metric k="Failed" v={String(stats.failed)} tone={stats.failed > 0 ? "critical" : "neutral"} />
              <Metric k="Max R" v={stats.max ? String(stats.max) : "—"} tone={stats.max >= 80 ? "critical" : "neutral"} />
              <Metric k="Lab" v={String(stats.lab)} tone="neutral" />
            </dl>

            <div className="space-y-1.5">
              <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                Risk band occupancy
              </p>
              {(
                [
                  ["critical", stats.byBand.critical, "bg-[hsl(var(--severity-critical))]"],
                  ["high", stats.byBand.high, "bg-[hsl(var(--severity-high))]"],
                  ["med", stats.byBand.med, "bg-[hsl(var(--severity-medium))]"],
                  ["low", stats.byBand.low, "bg-[hsl(var(--severity-low))]"],
                ] as const
              ).map(([label, count, bar]) => {
                const pct = orbit.length ? Math.round((count / orbit.length) * 100) : 0;
                return (
                  <div key={label} className="flex items-center gap-2">
                    <span className="w-12 font-mono text-[10px] uppercase text-muted-foreground">
                      {label}
                    </span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <motion.div
                        className={cn("h-full rounded-full", bar)}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.5, ease: easeOut }}
                      />
                    </div>
                    <span className="w-6 text-right font-mono text-[10px] tabular-nums text-foreground">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>

            <AnimatePresence mode="wait">
              {focus ? (
                <motion.div
                  key={focus.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.25, ease: easeOut }}
                  className={cn(
                    "rounded-md border px-3 py-3",
                    focus.live &&
                      "border-[hsl(var(--severity-info-border))] bg-[hsl(var(--severity-info-subtle))]",
                    focus.failed &&
                      !focus.live &&
                      "border-[hsl(var(--severity-critical-border))] bg-[hsl(var(--severity-critical-subtle))]",
                    focus.done &&
                      !focus.live &&
                      "border-[hsl(var(--severity-low-border))] bg-[hsl(var(--severity-low-subtle))]",
                    !focus.live && !focus.failed && !focus.done && "border-border bg-card"
                  )}
                >
                  <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    Focus node
                  </p>
                  <p className="mt-1 truncate text-[13px] font-semibold">{focus.name}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                    {focus.status} · {focus.rounds} · {focus.provider}/{focus.model}
                    {focus.lab ? " · lab" : ""}
                  </p>
                  <div className="mt-2 flex items-baseline justify-between gap-2">
                    <span
                      className={cn(
                        "font-mono text-[20px] font-semibold tabular-nums",
                        focus.risk >= 80
                          ? "text-[hsl(var(--severity-critical))]"
                          : "text-foreground"
                      )}
                    >
                      R{focus.risk}
                    </span>
                    <span className="font-mono text-[10px] uppercase text-muted-foreground">
                      {focus.band} band
                    </span>
                  </div>
                  <ButtonLink href={focus.href} live={focus.live} />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </aside>
        </div>
      </LandingMotionCard>

      {/* Motion watch cards */}
      <div>
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {running.length > 0 ? "Watching live" : "Watch cards"}
          </h3>
          <span className="font-mono text-[10px] text-muted-foreground">
            {running.length > 0 ? `${running.length} running` : "highest risk"}
          </span>
        </div>

        <motion.div
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {watchList.map((c, i) => {
            const b = bucket(c.status);
            const live = b === "running";
            const risk = riskScoreFromSummary(c.summary ?? null);
            const total = Math.max(1, Number(c.total_rounds || 1));
            const done = Number(c.rounds_completed || 0);
            const pct = Math.min(100, Math.round((done / total) * 100));
            const accent = live
              ? "from-primary/25 to-transparent"
              : b === "failed"
                ? "from-[hsl(var(--severity-critical))]/20 to-transparent"
                : b === "completed"
                  ? "from-[hsl(var(--severity-low))]/20 to-transparent"
                  : risk != null && risk >= 80
                    ? "from-[hsl(var(--severity-critical))]/15 to-transparent"
                    : "from-muted to-transparent";

            return (
              <motion.div key={c.id} variants={fadeUp} transition={{ ease: easeOut }}>
                <Link
                  href={`/red-team/monitor/${c.id}${live ? "?follow=1" : ""}`}
                  className="block h-full"
                  onMouseEnter={() => setFocusId(c.id)}
                >
                  <LandingMotionCard
                    index={i}
                    className={cn(
                      "flex h-full flex-col p-4 sm:p-5",
                      live &&
                        "border-[hsl(var(--severity-info-border))] bg-[hsl(var(--severity-info-subtle))] ring-1 ring-primary/25",
                      b === "failed" &&
                        !live &&
                        "border-[hsl(var(--severity-critical-border))] bg-[hsl(var(--severity-critical-subtle))]",
                      b === "completed" &&
                        !live &&
                        "border-[hsl(var(--severity-low-border))] bg-[hsl(var(--severity-low-subtle))]",
                      focusId === c.id && !live && "ring-1 ring-foreground/15"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {live ? (
                          <motion.span
                            className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary"
                            animate={{ opacity: [1, 0.55, 1] }}
                            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                          >
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="absolute inset-0 animate-ping rounded-full bg-primary/50" />
                              <span className="relative h-1.5 w-1.5 rounded-full bg-primary" />
                            </span>
                            Live
                          </motion.span>
                        ) : b === "failed" ? (
                          <span className="font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--severity-critical))]">
                            {c.status}
                          </span>
                        ) : b === "completed" ? (
                          <span className="font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--severity-low))]">
                            {c.status}
                          </span>
                        ) : (
                          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                            {c.status}
                          </span>
                        )}
                        <h4 className="mt-1.5 truncate text-[15px] font-semibold tracking-tight">
                          {c.name}
                        </h4>
                        <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                          {c.provider}/{c.model}
                        </p>
                      </div>
                      <ArrowUpRight
                        className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground"
                        aria-hidden
                      />
                    </div>

                    <div
                      className={cn(
                        "mt-4 rounded-lg border border-border/60 bg-gradient-to-br p-3",
                        accent
                      )}
                    >
                      <div className="flex flex-wrap gap-1.5">
                        {["Theater", "Rounds", risk != null ? `R${risk}` : "Risk"].map((chip, j) => (
                          <motion.span
                            key={chip}
                            className="rounded-md border border-border/70 bg-background/50 px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.12 + j * 0.06, ease: easeOut }}
                          >
                            {chip}
                          </motion.span>
                        ))}
                      </div>
                      <div className="mt-3 space-y-1.5">
                        <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
                          <span>
                            {done}/{c.total_rounds} rounds
                          </span>
                          <span>{pct}%</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
                          <motion.div
                            className={cn(
                              "h-full origin-left rounded-full",
                              live && "bg-primary",
                              b === "failed" && "bg-[hsl(var(--severity-critical))]",
                              b === "completed" && "bg-[hsl(var(--severity-low))]",
                              b === "other" && "bg-foreground/45"
                            )}
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: Math.max(live ? 0.08 : 0.02, pct / 100) }}
                            transition={{ delay: 0.2 + i * 0.05, duration: 0.55, ease: easeOut }}
                          />
                        </div>
                      </div>
                    </div>
                  </LandingMotionCard>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}

function Metric({
  k,
  v,
  tone = "neutral",
}: {
  k: string;
  v: string;
  tone?: "live" | "critical" | "neutral";
}) {
  return (
    <div className="rounded-md border border-border px-2.5 py-2">
      <dt className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{k}</dt>
      <dd
        className={cn(
          "mt-0.5 font-mono text-[16px] font-semibold tabular-nums",
          tone === "live" && "text-primary",
          tone === "critical" && "text-[hsl(var(--severity-critical))]",
          tone === "neutral" && "text-foreground"
        )}
      >
        {v}
      </dd>
    </div>
  );
}

function ButtonLink({ href, live }: { href: string; live: boolean }) {
  return (
    <Link
      href={href}
      className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-foreground underline-offset-2 hover:underline"
    >
      {live ? "Open live theater" : "Open theater"}
      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
    </Link>
  );
}
