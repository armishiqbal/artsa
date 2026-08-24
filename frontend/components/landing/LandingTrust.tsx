"use client";

import { motion } from "framer-motion";
import { BadgeCheck, FileKey2, Fingerprint, Shield } from "lucide-react";
import { easeOut, staggerContainer, fadeUp } from "@/lib/motionPresets";
import { LandingMotionCard } from "./LandingMotionCard";
import { LandingSectionHeader } from "./LandingSectionHeader";

const BADGES = [
  { icon: Shield, label: "OWASP LLM Top 10", sub: "Finding taxonomy" },
  { icon: Fingerprint, label: "MITRE ATLAS", sub: "Technique mapping" },
  { icon: FileKey2, label: "Tenant isolation", sub: "API-key scoping" },
  { icon: BadgeCheck, label: "Audit-ready exports", sub: "Readiness snapshots" },
] as const;

export function LandingTrust() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <LandingSectionHeader
          badge="Enterprise trust"
          title="Built for security reviewers, not slide decks"
          description="Every verdict, playbook version, and campaign finding is traceable — aligned to frameworks your auditors already know."
          align="center"
          className="max-w-3xl"
        />

        <motion.div
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
        >
          {BADGES.map((item, i) => (
            <motion.div key={item.label} variants={fadeUp} transition={{ ease: easeOut }}>
              <LandingMotionCard index={i} className="landing-trust-card p-5 text-center">
                <motion.div
                  className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary"
                  whileHover={{ rotate: [0, -6, 6, 0], scale: 1.06 }}
                  transition={{ duration: 0.45 }}
                >
                  <item.icon className="h-5 w-5" aria-hidden />
                </motion.div>
                <p className="mt-4 text-sm font-semibold">{item.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.sub}</p>
              </LandingMotionCard>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
