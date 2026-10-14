"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Swords, CheckCircle2, GitBranch, Layers } from "lucide-react";
import { easeOut, staggerContainer, fadeUp } from "@/lib/motionPresets";
import { demoHref } from "@/lib/demoRoutes";

const PILLARS = [
  {
    icon: Swords,
    step: "PILLAR 01",
    tag: "Threat Detection (ITDR)",
    tagColor: "border-rose-200 bg-rose-50 text-rose-700",
    title: "Agent Threat Detection & Response",
    body: "Submit supported tool-call events to the backend for evaluation and review its recorded verdict before your runtime proceeds.",
    highlight: "Backend response is shown to the connected runtime",
    href: demoHref("guard"),
    link: "Explore Threat Detection",
  },
  {
    icon: ShieldCheck,
    step: "PILLAR 02",
    tag: "Campaign workflows",
    tagColor: "border-blue-200 bg-blue-50 text-blue-700",
    title: "Configured Campaign Execution",
    body: "Run campaign jobs through the configured backend pipeline and review the resulting progress, events, and evaluations.",
    highlight: "Provider and storage availability depend on deployment configuration",
    href: demoHref("redteam"),
    link: "Explore Posture Management",
  },
  {
    icon: GitBranch,
    step: "PILLAR 03",
    tag: "Swarm Correlation",
    tagColor: "border-emerald-200 bg-emerald-50 text-emerald-700",
    title: "Cross-Agent Knowledge Graph",
    body: "Inspect recorded agent handoffs and related events for a selected session. The interface displays signature status supplied by the backend.",
    highlight: "Verification status is shown where supplied by the backend",
    href: demoHref("findings"),
    link: "Explore Knowledge Graph",
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
            THE ARTSA ARCHITECTURAL MODEL
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
            A Unified Platform Built for Agentic AI
          </h2>
          <p className="mt-4 text-base text-slate-600 sm:text-lg">
            ARTSA brings runtime event evaluation, campaign execution, and evidence review into one interface.
            Coverage depends on the connected backend, configured providers, and agent integration.
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
