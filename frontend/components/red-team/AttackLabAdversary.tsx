"use client";

import { motion } from "framer-motion";
import { LandingMotionCard } from "@/components/landing/LandingMotionCard";
import type {
  LabAttackerProfile,
  LabKillStage,
  LabOutcomeMix,
  LabPathHop,
  LabQuadrantPoint,
  LabStrategy,
} from "@/lib/attackLab";
import { easeOut, fadeUp, staggerContainer } from "@/lib/motionPresets";
import { cn } from "@/lib/utils";

type Props = {
  profile: LabAttackerProfile;
  path: LabPathHop[];
  stages: LabKillStage[];
  outcome: LabOutcomeMix;
  quadrant: LabQuadrantPoint[];
  onPickStrategy: (s: LabStrategy) => void;
  /** Apply strategy then run live probe. */
  onProbeStrategy: (s: LabStrategy) => void;
  /** Run live probe framed as this kill-chain stage. */
  onProbeStage: (stageId: string, label: string) => void;
  probing: boolean;
};

/** Attacker briefing + kill-chain pressure + outcome mix + stealth/impact map. */
export function AttackLabAdversary({
  profile,
  path,
  stages,
  outcome,
  quadrant,
  onPickStrategy,
  onProbeStrategy,
  onProbeStage,
  probing,
}: Props) {
  return (
    <motion.div
      className="space-y-4"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Attacker analysis
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-mono text-[10px] text-muted-foreground">{profile.intentSummary}</p>
          <button
            type="button"
            disabled={probing}
            onClick={() => onProbeStage("path", "full attack path")}
            className="rounded-sm border border-primary/40 bg-[hsl(var(--severity-info-subtle))] px-2 py-0.5 font-mono text-[10px] text-primary disabled:opacity-50"
          >
            {probing ? "Probing…" : "Probe path now"}
          </button>
        </div>
      </div>

      {/* Objective + path */}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <motion.div variants={fadeUp} transition={{ ease: easeOut }}>
          <LandingMotionCard
            index={0}
            glow={false}
            className="h-full border border-[hsl(var(--severity-critical-border))] bg-[hsl(var(--severity-critical-subtle))] p-4"
          >
            <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              Attacker objective
            </p>
            <p className="mt-2 text-[14px] leading-relaxed text-foreground">{profile.objective}</p>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  Entry vector
                </dt>
                <dd className="mt-0.5 text-[12px] text-foreground">{profile.entryVector}</dd>
              </div>
              <div>
                <dt className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  Profile
                </dt>
                <dd className="mt-0.5 flex flex-wrap gap-1.5">
                  <Tag
                    label={profile.stealth}
                    tone={
                      profile.stealth === "covert"
                        ? "critical"
                        : profile.stealth === "loud"
                          ? "low"
                          : "medium"
                    }
                  />
                  <Tag
                    label={profile.sophistication}
                    tone={
                      profile.sophistication === "high"
                        ? "critical"
                        : profile.sophistication === "medium"
                          ? "medium"
                          : "info"
                    }
                  />
                </dd>
              </div>
            </dl>
            <div className="mt-3">
              <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                Assets under pressure
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {profile.targetAssets.map((a) => (
                  <span
                    key={a}
                    className="rounded-sm border border-border bg-card/70 px-2 py-0.5 text-[11px] text-foreground"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
          </LandingMotionCard>
        </motion.div>

        <motion.div variants={fadeUp} transition={{ ease: easeOut }}>
          <LandingMotionCard index={1} glow={false} className="h-full border border-border bg-card p-4">
            <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              Attack path
            </p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Probe → runtime → detection — same story as Attack Graph stages.
            </p>
            <ol className="mt-4 space-y-0">
              {path.map((hop, i) => (
                <li key={hop.id} className="relative flex gap-3 pb-3 last:pb-0">
                  {i < path.length - 1 ? (
                    <span
                      className="absolute left-[7px] top-4 h-[calc(100%-8px)] w-px bg-border"
                      aria-hidden
                    />
                  ) : null}
                  <span
                    className={cn(
                      "relative z-[1] mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2",
                      hop.side === "attacker" &&
                        "border-[hsl(var(--severity-critical))] bg-[hsl(var(--severity-critical-subtle))]",
                      hop.side === "system" && "border-foreground/40 bg-muted",
                      hop.side === "defender" && "border-primary bg-[hsl(var(--severity-info-subtle))]"
                    )}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-[12px] font-medium text-foreground">{hop.label}</span>
                      <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                        {hop.side}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{hop.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </LandingMotionCard>
        </motion.div>
      </div>

      {/* Kill-chain pressure */}
      <LandingMotionCard index={2} glow={false} className="border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              Kill-chain pressure · estimate
            </p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Planning view of where this probe leans — confirm with a live check or campaign.
            </p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {stages.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.35, ease: easeOut }}
              className={cn(
                "rounded-md border px-2.5 py-2.5",
                s.hot
                  ? "border-[hsl(var(--severity-critical-border))] bg-[hsl(var(--severity-critical-subtle))]"
                  : "border-border bg-muted/20"
              )}
            >
              <div className="flex items-center justify-between gap-1">
                <p className="truncate text-[11px] font-medium text-foreground">{s.label}</p>
                <span
                  className={cn(
                    "font-mono text-[10px] tabular-nums",
                    s.hot ? "text-[hsl(var(--severity-critical))]" : "text-muted-foreground"
                  )}
                >
                  {s.pressure}
                </span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                <motion.div
                  className={cn(
                    "h-full rounded-full",
                    s.hot
                      ? "bg-[hsl(var(--severity-critical))]"
                      : s.pressure >= 60
                        ? "bg-[hsl(var(--severity-high))]"
                        : "bg-primary"
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${s.pressure}%` }}
                  transition={{ duration: 0.45, delay: i * 0.04, ease: easeOut }}
                />
              </div>
              <p className="mt-2 text-[10px] leading-snug text-muted-foreground">{s.attackerMove}</p>
              <p className="mt-1 font-mono text-[9px] text-muted-foreground/80">{s.control}</p>
              <button
                type="button"
                disabled={probing}
                onClick={() => onProbeStage(s.id, s.label)}
                className="mt-2 w-full rounded-sm border border-border bg-card/80 py-1 font-mono text-[9px] uppercase tracking-wider text-foreground hover:border-primary/40 disabled:opacity-50"
              >
                {probing ? "…" : "Probe stage"}
              </button>
            </motion.div>
          ))}
        </div>
      </LandingMotionCard>

      {/* Outcome mix + quadrant */}
      <div className="grid gap-3 lg:grid-cols-2">
        <LandingMotionCard index={3} glow={false} className="border border-border bg-card p-4">
          <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            Expected outcome mix · estimate
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">{outcome.note}</p>
          <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-muted">
            <Seg pct={outcome.breachPct} className="bg-[hsl(var(--severity-critical))]" title="Breach" />
            <Seg pct={outcome.detectPct} className="bg-primary" title="Detect" />
            <Seg pct={outcome.containPct} className="bg-[hsl(var(--severity-low))]" title="Contain" />
            <Seg pct={outcome.missPct} className="bg-muted-foreground/40" title="Miss" />
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
            <MixRow label="Breach / hit" pct={outcome.breachPct} tone="critical" />
            <MixRow label="Detected" pct={outcome.detectPct} tone="info" />
            <MixRow label="Contained" pct={outcome.containPct} tone="low" />
            <MixRow label="Miss / noise" pct={outcome.missPct} tone="muted" />
          </ul>
        </LandingMotionCard>

        <LandingMotionCard index={4} glow={false} className="border border-border bg-card p-4">
          <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            Attacker tradeoff · impact × stealth
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Click a point to lock strategy. Upper-right = harder to catch, higher pressure.
          </p>
          <div className="relative mt-3 h-44 rounded-md border border-border bg-muted/40">
            {/* Quadrant guides */}
            <div className="pointer-events-none absolute inset-0 grid grid-cols-2 grid-rows-2">
              <div className="border-b border-r border-border/60" />
              <div className="border-b border-border/60" />
              <div className="border-r border-border/60" />
              <div />
            </div>
            <span className="pointer-events-none absolute bottom-1 left-2 font-mono text-[8px] uppercase tracking-wider text-muted-foreground">
              Impact →
            </span>
            <span className="pointer-events-none absolute left-1 top-2 origin-left -rotate-90 font-mono text-[8px] uppercase tracking-wider text-muted-foreground">
              Stealth →
            </span>
            <span className="pointer-events-none absolute right-2 top-2 font-mono text-[8px] text-muted-foreground">
              covert / high
            </span>
            <span className="pointer-events-none absolute bottom-1 right-2 font-mono text-[8px] text-muted-foreground">
              loud / high
            </span>
            {quadrant.map((p) => {
              const left = `${8 + (p.impact / 100) * 84}%`;
              const bottom = `${8 + (p.stealth / 100) * 78}%`;
              return (
                <button
                  key={p.strategy}
                  type="button"
                  title={`${p.strategy}: impact R${p.impact}, stealth ${p.stealth}`}
                  onClick={() => onPickStrategy(p.strategy)}
                  className={cn(
                    "absolute h-3 w-3 -translate-x-1/2 translate-y-1/2 rounded-full border-2 transition-transform hover:scale-125",
                    p.active
                      ? "z-10 border-primary bg-primary shadow-[0_0_0_3px_hsl(var(--severity-info-subtle))]"
                      : "border-foreground/30 bg-card hover:border-foreground/60"
                  )}
                  style={{ left, bottom }}
                >
                  <span className="sr-only">{p.strategy}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {quadrant.map((p) => (
              <div key={`leg-${p.strategy}`} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onPickStrategy(p.strategy)}
                  className={cn(
                    "rounded-sm border px-1.5 py-0.5 font-mono text-[9px]",
                    p.active
                      ? "border-primary/40 bg-[hsl(var(--severity-info-subtle))] text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {p.strategy}
                </button>
                <button
                  type="button"
                  disabled={probing}
                  onClick={() => onProbeStrategy(p.strategy)}
                  className="rounded-sm border border-border px-1.5 py-0.5 font-mono text-[9px] text-primary hover:border-primary/40 disabled:opacity-50"
                >
                  Probe
                </button>
              </div>
            ))}
          </div>
        </LandingMotionCard>
      </div>
    </motion.div>
  );
}

function Tag({
  label,
  tone,
}: {
  label: string;
  tone: "critical" | "medium" | "low" | "info";
}) {
  return (
    <span
      className={cn(
        "rounded-sm border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider",
        tone === "critical" &&
          "border-[hsl(var(--severity-critical-border))] text-[hsl(var(--severity-critical))]",
        tone === "medium" &&
          "border-[hsl(var(--severity-medium-border))] text-[hsl(var(--severity-medium))]",
        tone === "low" &&
          "border-[hsl(var(--severity-low-border))] text-[hsl(var(--severity-low))]",
        tone === "info" && "border-[hsl(var(--severity-info-border))] text-primary"
      )}
    >
      {label}
    </span>
  );
}

function Seg({ pct, className, title }: { pct: number; className: string; title: string }) {
  if (pct <= 0) return null;
  return (
    <span
      className={cn("h-full", className)}
      style={{ width: `${pct}%` }}
      title={`${title} ${pct}%`}
    />
  );
}

function MixRow({
  label,
  pct,
  tone,
}: {
  label: string;
  pct: number;
  tone: "critical" | "info" | "low" | "muted";
}) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/20 px-2 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-mono tabular-nums",
          tone === "critical" && "text-[hsl(var(--severity-critical))]",
          tone === "info" && "text-primary",
          tone === "low" && "text-[hsl(var(--severity-low))]",
          tone === "muted" && "text-muted-foreground"
        )}
      >
        {pct}%
      </span>
    </li>
  );
}
