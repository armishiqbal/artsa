"use client";

import { motion } from "framer-motion";
import { Bot, Terminal, Network, Database, ShieldAlert, Users, Eye, Code, Award } from "lucide-react";
import { easeOut, staggerContainer, fadeUp } from "@/lib/motionPresets";

const CASES = [
  {
    icon: Bot,
    tag: "Customer-Facing",
    title: "Customer Support & CRM Agents",
    threat: "Indirect prompt injection via user chat seeking PII, unauthorized refunds, or private knowledge base data.",
    mitigation: "Connect policy evaluation before the tool call and verify the integration's enforcement behavior.",
  },
  {
    icon: Terminal,
    tag: "High Privilege",
    title: "Autonomous Coding & DevOps",
    threat: "Rogue system shell execution, reverse shell pipes, container escapes, and production credential dumps.",
    mitigation: "Use supported tool or MCP boundaries and validate command policy behavior in your environment.",
  },
  {
    icon: Network,
    tag: "Multi-Agent DAG",
    title: "Swarm Orchestrations",
    threat: "Lateral contagion where a compromised triage agent tricks a privileged worker agent via internal delegation.",
    mitigation: "Record supported handoffs and review the backend's signature status and session-level action result.",
  },
  {
    icon: Database,
    tag: "RAG & Vector DB",
    title: "Enterprise Knowledge Retrieval",
    threat: "Poisoned vector retrieval documents executing prompt injections upon model generation.",
    mitigation: "Evaluate retrieved content at a configured integration boundary before passing it to the model.",
  },
] as const;

const PERSONAS = [
  {
    icon: Award,
    role: "CISOs & Security Executives",
    value: "Board-Ready Governance & Compliance",
    bullets: [
      "Unified fleet-wide security posture score (ASPM)",
      "Framework references in supported findings and reports",
      "Cryptographic HMAC proofs for non-repudiation audit defense",
    ],
  },
  {
    icon: Eye,
    role: "SOC Teams & Incident Responders",
    value: "Real-Time Containment & Autopsy",
    bullets: [
      "Session-scoped action workflows with backend-reported status",
      "Frame-by-frame session filmstrip autopsy to trace attack lifecycles",
      "Finding-to-playbook suggestion workflow for review",
    ],
  },
  {
    icon: Code,
    role: "AI Architects & Engineering Teams",
    value: "Zero-Friction Developer Experience",
    bullets: [
      "Python and TypeScript clients for supported API paths",
      "Framework wrappers are documented for selected agent integrations",
      "Measure request latency in your own configured environment",
    ],
  },
] as const;

export function LandingUseCases() {
  return (
    <section id="use-cases" className="lp-section scroll-mt-24 border-t border-slate-200/80 bg-slate-50/70 py-20 sm:py-28">
      <div className="lp-shell">
        {/* Section 1: Environments & Agent Roles */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, ease: easeOut }}
          className="mx-auto max-w-3xl text-center"
        >
          <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3.5 py-1 text-xs font-mono font-medium text-blue-700 mb-3 shadow-xs">
            <ShieldAlert className="h-3.5 w-3.5" />
            ENTERPRISE THREAT SCENARIOS
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
            Targeted Defense Where Blast Radiuses Differ
          </h2>
          <p className="mt-4 text-base text-slate-600 sm:text-lg">
            Different agent roles present radically different blast radiuses. ARTSA applies
            tailored policies whether an agent talks to customers, code repositories, or production clusters.
          </p>
        </motion.div>

        <motion.div
          className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {CASES.map((c) => {
            const Icon = c.icon;
            return (
              <motion.article
                key={c.title}
                variants={fadeUp}
                transition={{ ease: easeOut }}
                className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs transition-all hover:border-blue-300 hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-mono font-medium text-slate-600">
                      {c.tag}
                    </span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-100 bg-blue-50/80 text-blue-600 transition-transform group-hover:scale-105">
                      <Icon className="h-4.5 w-4.5" aria-hidden />
                    </div>
                  </div>

                  <h3 className="mt-4 text-base font-semibold text-slate-900">
                    {c.title}
                  </h3>

                  <div className="mt-4 space-y-2.5 text-xs">
                    <div className="rounded-lg bg-rose-50/70 border border-rose-200/70 p-3 font-mono text-rose-900">
                      <span className="font-bold uppercase text-[9px] text-rose-700 block mb-0.5">Threat Vector:</span>
                      {c.threat}
                    </div>
                    <div className="rounded-lg bg-emerald-50/70 border border-emerald-200/70 p-3 font-mono text-emerald-900">
                      <span className="font-bold uppercase text-[9px] text-emerald-700 block mb-0.5">ARTSA Containment:</span>
                      {c.mitigation}
                    </div>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </motion.div>

        {/* Section 2: Enterprise Solutions by Role */}
        <div className="mt-20 pt-16 border-t border-slate-200/80">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, ease: easeOut }}
            className="mx-auto max-w-3xl text-center"
          >
            <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3.5 py-1 text-xs font-mono font-medium text-blue-700 mb-3 shadow-xs">
              <Users className="h-3.5 w-3.5" />
              SOLUTIONS BY STAKEHOLDER
            </div>
            <h3 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl md:text-4xl">
              Engineered for the Entire Security Organization
            </h3>
            <p className="mt-3 text-sm text-slate-600 sm:text-base">
              From executive oversight to frontline triage and agent development, ARTSA provides
              dedicated surfaces for every team involved in deploying enterprise AI.
            </p>
          </motion.div>

          <motion.div
            className="mt-12 grid gap-6 md:grid-cols-3"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {PERSONAS.map((p) => {
              const Icon = p.icon;
              return (
                <motion.div
                  key={p.role}
                  variants={fadeUp}
                  transition={{ ease: easeOut }}
                  className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-xs hover:shadow-md hover:border-blue-300 transition-all"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h4 className="mt-4 font-mono text-xs font-bold uppercase tracking-wider text-blue-700">
                    {p.role}
                  </h4>
                  <p className="mt-1.5 text-base font-semibold text-slate-900">
                    {p.value}
                  </p>
                  <ul className="mt-5 space-y-2.5 text-xs text-slate-600">
                    {p.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2">
                        <span className="text-emerald-600 font-bold">✓</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
