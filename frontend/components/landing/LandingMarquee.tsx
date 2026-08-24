"use client";

import { motion } from "framer-motion";
import { easeOut } from "@/lib/motionPresets";

const ITEMS = [
  "OWASP LLM Top 10",
  "MITRE ATLAS",
  "Sub-50ms containment",
  "Multi-tenant RBAC",
  "Chain of custody",
  "Red team campaigns",
  "Playbook versioning",
  "Session autopsy",
  "Layered detection",
  "Audit exports",
  "Agent topology",
  "Live observatory",
] as const;

export function LandingMarquee() {
  return (
    <section className="landing-marquee border-y border-border/40 py-4" aria-hidden>
      <div className="landing-marquee__track flex gap-3">
        {[...ITEMS, ...ITEMS].map((label, i) => (
          <span key={`${label}-${i}`} className="landing-marquee__pill shrink-0">
            {label}
          </span>
        ))}
      </div>
    </section>
  );
}

export function LandingMarqueeAnimated() {
  return (
    <motion.section
      className="landing-marquee border-y border-border/40 py-4"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, ease: easeOut }}
    >
      <LandingMarquee />
    </motion.section>
  );
}
