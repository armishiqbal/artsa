"use client";

import { motion } from "framer-motion";
import { AnimatedNumber } from "@/components/shared/AnimatedNumber";
import { easeOut, staggerContainer, fadeUp } from "@/lib/motionPresets";

const METRICS = [
  { value: 42, suffix: "ms", label: "Containment p99", detail: "Ingest → verdict SLO" },
  { value: 3, suffix: "", label: "Detection layers", detail: "Semantic · policy · behavioral" },
  { value: 10, suffix: "", label: "OWASP LLM risks", detail: "Mapped finding taxonomy" },
  { value: 100, suffix: "%", label: "Audit trail coverage", detail: "Sessions · campaigns · playbooks" },
] as const;

export function LandingMetrics() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20" aria-label="Platform metrics">
      <motion.div
        className="mx-auto grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-4"
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        {METRICS.map((m) => (
          <motion.div
            key={m.label}
            variants={fadeUp}
            transition={{ ease: easeOut }}
            className="landing-metrics-cell text-center sm:text-left"
          >
            <p className="font-mono text-4xl font-medium tracking-tight tabular-nums sm:text-5xl">
              <AnimatedNumber value={m.value} duration={0.9} />
              {m.suffix ? (
                <span className="text-2xl text-primary sm:text-3xl">{m.suffix}</span>
              ) : null}
            </p>
            <p className="mt-2 text-sm font-medium">{m.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{m.detail}</p>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
