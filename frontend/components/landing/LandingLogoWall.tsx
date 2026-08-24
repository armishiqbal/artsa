"use client";

import { motion } from "framer-motion";
import { easeOut, staggerContainer, fadeUp } from "@/lib/motionPresets";

const LOGOS = [
  "OWASP",
  "MITRE ATLAS",
  "NIST AI RMF",
  "SOC 2",
  "EU AI Act",
  "Agentic TRiSM",
] as const;

export function LandingLogoWall() {
  return (
    <section className="py-10 sm:py-12" aria-label="Framework alignment">
      <div className="lp-shell">
        <p className="lp-eyebrow text-center">Trusted by security teams auditing against</p>
        <motion.ul
          className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-4"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {LOGOS.map((name) => (
            <motion.li
              key={name}
              variants={fadeUp}
              transition={{ ease: easeOut }}
              className="lp-logo-strip__item"
            >
              {name}
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}
