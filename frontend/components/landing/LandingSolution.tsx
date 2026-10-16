"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Swords, CheckCircle2, GitBranch, Layers } from "lucide-react";
import { easeOut, staggerContainer, fadeUp } from "@/lib/motionPresets";

const PILLARS = [
  {
    icon: Swords,
    step: "PILLAR 01",
    tag: "Runtime Guard",
    tagColor: "border-rose-200 bg-rose-50 text-rose-700",
    title: "Inline Tool & Shell Guard",
    body: "Inspect tool-call arguments before execution. Automatically quarantine destructive commands, SQL injections, and data exfiltration pipelines in sub-10ms.",
    highlight: "Deterministic sub-10ms latency",
    href: "#integrations",
    link: "View SDK integration",
  },
  {
    icon: ShieldCheck,
    step: "PILLAR 02",
    tag: "Adversarial Campaigns",
    tagColor: "border-blue-200 bg-blue-50 text-blue-700",
    title: "Continuous Red Team Scans",
    body: "Subject your agent architectures to automated multi-turn jailbreaks, prompt injections, and privilege escalation techniques before deployment.",
    highlight: "Automated ASI-01 to ASI-10 evaluation",
    href: "/signup",
    link: "Start automated audit",
  },
  {
    icon: GitBranch,
    step: "PILLAR 03",
    tag: "Swarm DAG",
    tagColor: "border-emerald-200 bg-emerald-50 text-emerald-700",
    title: "Evidence & Session Autopsy",
    body: "Replay agent execution step-by-step with full parameter inspection, tool responses, and cryptographic custody verification for compliance audits.",
    highlight: "HMAC-signed non-repudiation records",
    href: "/signup",
    link: "Inspect forensic ledger",
  },
] as const;

export function LandingSolution() {
  return (
    <section id="solution" className="scroll-mt-24 bg-white py-20 sm:py-28 border-b border-slate-100">
      <div className="lp-shell">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, ease: easeOut }}
          className="mx-auto max-w-3xl text-center"
        >
          <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200/80 bg-blue-50 px-3.5 py-1 text-xs font-mono font-medium text-blue-700 mb-3 shadow-xs">
            <Layers className="h-3.5 w-3.5" />
            UNIFIED PLATFORM ARCHITECTURE
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
            Complete Security for the Agentic Lifecycle
          </h2>
          <p className="mt-4 text-base text-slate-600 sm:text-lg">
            From pre-deployment adversarial testing to inline runtime interception and compliance forensic proofs.
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
                className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs transition-all hover:border-blue-400 hover:shadow-lg"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold tracking-widest text-blue-600">
                      {p.step}
                    </span>
                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-mono font-semibold ${p.tagColor}`}>
                      {p.tag}
                    </span>
                  </div>

                  <div className="mt-6 flex h-12 w-12 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700 transition-transform group-hover:scale-105">
                    <Icon className="h-6 w-6" strokeWidth={1.75} aria-hidden />
                  </div>

                  <h3 className="mt-5 text-xl font-semibold tracking-tight text-slate-900">
                    {p.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">
                    {p.body}
                  </p>
                </div>

                <div className="mt-8 border-t border-slate-100 pt-4">
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-700 mb-4">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>{p.highlight}</span>
                  </div>
                  <Link
                    href={p.href}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold font-mono text-blue-600 transition-colors hover:text-blue-800"
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
