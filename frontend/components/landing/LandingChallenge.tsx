"use client";

import { motion } from "framer-motion";
import { AlertCircle, Zap, ShieldAlert, Lock, EyeOff } from "lucide-react";
import { easeOut, staggerContainer, fadeUp } from "@/lib/motionPresets";

const PAINS = [
  {
    icon: Zap,
    title: "Agents Chain Faster Than Security Can Watch",
    body: "Tool calls, MCP servers, and agent handoffs can spread work across several systems, making the execution path harder to review.",
  },
  {
    icon: Lock,
    title: "Static Configuration is Not Runtime Security",
    body: "Access policies describe what an agent may do. Event records add context about the tools and handoffs it actually used.",
  },
  {
    icon: AlertCircle,
    title: "Siloed Logs Cannot Stop a Live Escape Chain",
    body: "Logs support investigation, while containment requires an enforcement point that can act during the relevant session.",
  },
  {
    icon: EyeOff,
    title: "Vendor Copilot Guards Create Dangerous Silos",
    body: "Separate model and tool integrations can make it difficult to connect related events across an agent workflow.",
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
            THE AGENTIC ATTACK SURFACE
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
            You Can&apos;t Contain What You Can&apos;t See
          </h2>
          <p className="mt-4 text-base text-slate-600 sm:text-lg">
            AI agents can chain tasks across tools and use inherited credentials. Review requires records
            from the systems and integrations that participate in that workflow.
          </p>
        </motion.div>

        <motion.ul
          className="mt-14 grid gap-6 sm:grid-cols-2"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {PAINS.map((item) => {
            const Icon = item.icon;
            return (
              <motion.li
                key={item.title}
                variants={fadeUp}
                transition={{ ease: easeOut }}
                className="group rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-xs transition-all hover:border-slate-300 hover:shadow-md"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700 mb-4 transition-transform group-hover:scale-105">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.body}</p>
              </motion.li>
            );
          })}
        </motion.ul>

      </div>
    </section>
  );
}
