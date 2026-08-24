"use client";

import { motion } from "framer-motion";
import { Gauge, Shield, FileCheck, Layers } from "lucide-react";
import { easeOut, staggerContainer, fadeUp } from "@/lib/motionPresets";
import { AnimatedNumber } from "@/components/shared/AnimatedNumber";

const STATS = [
  { icon: Gauge, value: 42, suffix: "ms", label: "Containment p99 latency" },
  { icon: Layers, value: 3, suffix: "", label: "Detection layers in parallel" },
  { icon: Shield, value: 10, suffix: "", label: "OWASP LLM risks mapped" },
  { icon: FileCheck, value: 100, suffix: "%", label: "Audit trail coverage" },
] as const;

export function LandingHowItWorks() {
  return (
    <section id="how-it-works" className="lp-section">
      <div className="lp-shell">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, ease: easeOut }}
        >
          <p className="lp-eyebrow">How it works</p>
          <h2 className="lp-heading mt-6 max-w-2xl">
            Ingest. Score. Contain. Prove.
          </h2>
          <p className="lp-body mt-4 max-w-xl">
            ARTSA sits inline with your agent runtime — every tool call is inspected before it
            lands, with chain-of-custody ready for the SOC and the board.
          </p>
        </motion.div>

        <motion.div
          className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {STATS.map((s) => {
            const Icon = s.icon;
            return (
              <motion.div
                key={s.label}
                variants={fadeUp}
                transition={{ ease: easeOut }}
                className="lp-stat-card"
              >
                <Icon className="lp-stat-card__icon" strokeWidth={1.75} aria-hidden />
                <p className="lp-stat-card__value tabular-nums">
                  <AnimatedNumber value={s.value} duration={1.1} />
                  {s.suffix}
                </p>
                <p className="lp-stat-card__label">{s.label}</p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
