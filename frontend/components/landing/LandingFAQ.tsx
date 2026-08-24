"use client";

import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { easeOut, staggerContainer, fadeUp } from "@/lib/motionPresets";

const FAQ = [
  {
    q: "Do I need to sign up to try ARTSA?",
    a: "No. The live demo runs entirely in your browser — guard scans, red-team grid, findings, and replay — with no account.",
  },
  {
    q: "How fast is runtime containment?",
    a: "We target sub-50ms p99 from ingest to verdict. Tool calls are scored across semantic, policy, and behavioral layers in the same session.",
  },
  {
    q: "Can I wire ARTSA without rewriting agents?",
    a: "Yes. Use curl, the Python/TypeScript SDK, or provider configs. Your agents keep their stack — ARTSA observes at the gateway.",
  },
  {
    q: "What frameworks do you align with?",
    a: "Findings map to OWASP LLM Top 10 and MITRE ATLAS. Readiness exports support NIST AI RMF and EU AI Act workflows.",
  },
  {
    q: "How does Enterprise onboarding work?",
    a: "Contact sales for SSO/SAML, VPC deploy, and compliance packs. A solutions engineer schedules a tailored demo within one business day.",
  },
] as const;

export function LandingFAQ() {
  return (
    <section id="faq" className="lp-section border-t border-[var(--color-steel-border)]">
      <div className="lp-shell max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, ease: easeOut }}
          className="text-center"
        >
          <p className="lp-eyebrow">FAQ</p>
          <h2 className="lp-heading mt-6">Questions</h2>
        </motion.div>
        <motion.div
          className="mt-10 space-y-2"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {FAQ.map((item) => (
            <motion.details
              key={item.q}
              variants={fadeUp}
              transition={{ ease: easeOut }}
              className="group rounded-[8px] border border-[var(--color-steel-border)] bg-[var(--color-card-carbon)] open:border-[var(--color-graphite)]"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[14px] font-medium tracking-[-0.17px] text-[var(--color-snow)] marker:content-none">
                {item.q}
                <ChevronDown
                  className="h-4 w-4 shrink-0 text-[var(--color-ash)] transition-transform group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <p className="border-t border-[var(--color-steel-border)] px-5 pb-4 pt-3 text-[14px] leading-relaxed text-[var(--color-ash)]">
                {item.a}
              </p>
            </motion.details>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
