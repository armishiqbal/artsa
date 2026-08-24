"use client";

import { motion } from "framer-motion";
import {
  Ban,
  Gauge,
  Lock,
  Rocket,
  Scale,
  Sparkles,
} from "lucide-react";
import { easeOut, staggerContainer, fadeUp } from "@/lib/motionPresets";
import { LandingSectionHeader } from "./LandingSectionHeader";

/** Lakera-style benefit pillars */
const BENEFITS = [
  {
    icon: Ban,
    title: "Stop attacks before impact",
    body: "Block prompt injection, tool policy violations, and goal hijacks at ingest — not in tomorrow's scan report.",
  },
  {
    icon: Gauge,
    title: "Adapt in real time",
    body: "Live observatory and WebSocket telemetry keep defenders ahead of fast-moving agent behavior.",
  },
  {
    icon: Rocket,
    title: "Ship without slowing builders",
    body: "API-first ingest and SDK snippets — security teams get visibility without rewriting agent runtimes.",
  },
  {
    icon: Scale,
    title: "Earn auditor confidence",
    body: "Readiness exports, playbook versions, and chain-of-custody mapped to OWASP LLM and MITRE ATLAS.",
  },
  {
    icon: Lock,
    title: "Tenant isolation",
    body: "API-key scoping, org policy YAML, and RBAC — enterprise controls from day one.",
  },
  {
    icon: Sparkles,
    title: "Precision over noise",
    body: "Layered scores roll into one severity verdict — fewer false positives, clearer escalation.",
  },
] as const;

export function LandingBenefits() {
  return (
    <section className="px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <LandingSectionHeader
          badge="Why ARTSA"
          title="Security designed for AI — not retrofitted onto it"
          description="The outcomes Lakera promises for runtime and red team — continuous protection, ultra-low latency, and collaborative remediation — built into one command center."
          align="center"
          className="mx-auto max-w-3xl"
        />

        <motion.div
          className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
        >
          {BENEFITS.map((b) => (
            <motion.article
              key={b.title}
              variants={fadeUp}
              transition={{ ease: easeOut }}
              className="rounded-2xl border border-border/40 bg-muted/10 p-5"
            >
              <b.icon className="h-5 w-5 text-primary" aria-hidden />
              <h3 className="mt-3 font-medium">{b.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{b.body}</p>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
