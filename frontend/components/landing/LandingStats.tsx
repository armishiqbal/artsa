"use client";

import { motion } from "framer-motion";
import { AnimatedNumber } from "@/components/shared/AnimatedNumber";
import { easeOut, staggerContainer, fadeUp } from "@/lib/motionPresets";
import { LandingMotionCard } from "./LandingMotionCard";

const STATS = [
  { label: "Containment p99", value: 42, suffix: "ms", detail: "Ingest → verdict SLO" },
  { label: "Threats intercepted", value: 847, suffix: "", detail: "Last 24h demo fleet" },
  { label: "Active agent sessions", value: 12, suffix: "", detail: "Live observatory" },
  { label: "Defense score", value: 92, suffix: "", detail: "Weighted layer composite" },
] as const;

export function LandingStats() {
  return (
    <section className="px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <motion.div
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
        >
          {STATS.map((stat, i) => (
            <motion.div key={stat.label} variants={fadeUp} transition={{ ease: easeOut }}>
              <LandingMotionCard
                index={i}
                className="landing-stat-card p-4 sm:p-5"
                glow={false}
              >
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {stat.label}
                </p>
                <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-foreground">
                  <AnimatedNumber value={stat.value} duration={0.9} />
                  {stat.suffix ? (
                    <span className="text-lg text-primary">{stat.suffix}</span>
                  ) : null}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{stat.detail}</p>
              </LandingMotionCard>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
