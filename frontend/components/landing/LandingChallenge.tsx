"use client";

import { motion } from "framer-motion";
import { Zap, Lock, AlertCircle, EyeOff, ShieldAlert } from "lucide-react";
import { easeOut, staggerContainer, fadeUp } from "@/lib/motionPresets";

const REALITIES = [
  {
    icon: Zap,
    title: "Agents Are Funded to Act, Not Just Answer",
    body: "Autonomous agents are no longer just summarizing text. They connect directly to production databases, terminal shells, and payment gateways with inherited permissions.",
  },
  {
    icon: Lock,
    title: "Traditional Firewalls Only Inspect Text",
    body: "Web Application Firewalls (WAFs) and API gateways examine HTTP packets, but are blind to tool-call intent, poisoned vector retrieval context, and runtime goal drift.",
  },
  {
    icon: AlertCircle,
    title: "Lateral Contagion Spreads Across Swarms",
    body: "When an external triage bot is tricked via indirect prompt injection, it delegates malicious instructions to privileged background workers inside your private network.",
  },
  {
    icon: EyeOff,
    title: "Post-Mortem Logs Cannot Stop Active Breaches",
    body: "Discovering an exfiltration loop in CloudWatch or Datadog hours later is too late. Autonomous speed requires sub-10ms inline containment before code executes.",
  },
] as const;

export function LandingChallenge() {
  return (
    <section id="challenge" className="scroll-mt-24 border-b border-slate-200 bg-slate-50/70 py-20 sm:py-28">
      <div className="lp-shell">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, ease: easeOut }}
          className="mx-auto max-w-3xl text-center"
        >
          <div className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3.5 py-1 text-xs font-mono font-medium text-rose-700 mb-3 shadow-xs">
            <ShieldAlert className="h-3.5 w-3.5" />
            THE AGENTIC PERIMETER
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
            Why Traditional Security Fails with AI Agents
          </h2>
          <p className="mt-4 text-base text-slate-600 sm:text-lg">
            When software acts with autonomy, identity and execution context become the new perimeter.
          </p>
        </motion.div>

        <motion.div
          className="mt-14 grid gap-6 sm:grid-cols-2"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {REALITIES.map((item) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                variants={fadeUp}
                transition={{ ease: easeOut }}
                className="group rounded-2xl border border-slate-200/90 bg-white p-7 shadow-xs transition-all hover:border-slate-300 hover:shadow-md"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700 mb-5 transition-transform group-hover:scale-105">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.body}</p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
