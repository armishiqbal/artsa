"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Swords, CheckCircle2, GitBranch, Shield } from "lucide-react";
import { easeOut, staggerContainer, fadeUp } from "@/lib/motionPresets";

const PILLARS = [
  {
    icon: Swords,
    step: "01 · TEST",
    tag: "Pre-Flight",
    title: "Continuous Red Team Scans",
    body: "Subject your agent architectures to automated multi-turn jailbreaks, prompt injections, and privilege escalation techniques before shipping.",
    highlight: "Automated OWASP ASI01-ASI10 benchmarks",
    href: "/findings",
    link: "Explore findings & matrix",
  },
  {
    icon: ShieldCheck,
    step: "02 · SHIELD",
    tag: "Runtime",
    title: "Sub-10ms Inline Tool Guard",
    body: "Inspect tool-call arguments before execution. Automatically quarantine destructive bash commands, SQL injections, and data exfiltration pipelines.",
    highlight: "Deterministic sub-10ms fail-closed latency",
    href: "#integrations",
    link: "View 2-line quickstart",
  },
  {
    icon: GitBranch,
    step: "03 · VERIFY",
    tag: "Audit",
    title: "Forensic Replay & Evidence",
    body: "Step through execution histories with full parameter inspection, tool responses, and cryptographic HMAC custody verification for audits.",
    highlight: "Cryptographic HMAC non-repudiation",
    href: "/replay",
    link: "Inspect forensic replay",
  },
] as const;

export function LandingSolution() {
  return (
    <section id="platform" className="scroll-mt-24 bg-[#070707] py-20 sm:py-28 border-b border-neutral-800">
      <div id="solution" className="sr-only" />
      <div className="lp-shell">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, ease: easeOut }}
          className="mx-auto max-w-3xl text-center"
        >
          <div className="inline-flex items-center gap-1.5 rounded-full border border-neutral-800 bg-neutral-900/90 px-3.5 py-1 text-xs font-mono font-medium text-neutral-300 mb-3 shadow-2xs">
            <Shield className="h-3.5 w-3.5 text-neutral-400" />
            3-PILLAR AGENT SECURITY
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
            Test Before Launch. Guard In Production.
          </h2>
          <p className="mt-4 text-base text-neutral-400 sm:text-lg font-sans">
            A single unified control plane covering pre-deployment adversarial testing, sub-10ms inline runtime interception, and cryptographic compliance proof.
          </p>
        </motion.div>

        <motion.div
          className="mt-14 grid gap-6 md:grid-cols-3"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {PILLARS.map((p) => {
            const Icon = p.icon;
            return (
              <motion.article
                key={p.title}
                variants={fadeUp}
                transition={{ ease: easeOut }}
                className="group relative flex flex-col justify-between rounded-2xl border border-neutral-800 bg-[#0e0e0e] p-6 sm:p-8 shadow-md transition-all hover:border-neutral-700 hover:bg-[#121212]"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold tracking-wider text-white">
                      {p.step}
                    </span>
                    <span className="rounded-full border border-neutral-800 bg-neutral-900 px-2.5 py-0.5 text-[10px] font-mono font-semibold text-neutral-300">
                      {p.tag}
                    </span>
                  </div>

                  <div className="mt-6 flex h-12 w-12 items-center justify-center rounded-xl border border-neutral-800 bg-[#161616] text-neutral-200 transition-transform group-hover:scale-105">
                    <Icon className="h-6 w-6" strokeWidth={1.75} aria-hidden />
                  </div>

                  <h3 className="mt-5 text-xl font-semibold tracking-tight text-white">
                    {p.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-neutral-400 font-sans">
                    {p.body}
                  </p>
                </div>

                <div className="mt-8 border-t border-neutral-800/80 pt-4">
                  <div className="flex items-center gap-2 text-xs font-mono text-neutral-300 mb-4">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <span>{p.highlight}</span>
                  </div>
                  <Link
                    href={p.href}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold font-mono text-white transition-colors hover:text-neutral-300 hover:underline"
                  >
                    {p.link} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </div>
              </motion.article>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
