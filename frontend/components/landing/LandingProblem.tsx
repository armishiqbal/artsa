"use client";

import { motion } from "framer-motion";
import { AlertTriangle, EyeOff, ShieldOff, Zap } from "lucide-react";
import { easeOut, staggerContainer, fadeUp } from "@/lib/motionPresets";
import { LandingSectionHeader } from "./LandingSectionHeader";

const PROBLEMS = [
  {
    icon: EyeOff,
    title: "Agents deploy faster than security can track",
    body: "Tool calls, MCP servers, and multi-agent pipelines create blind spots that grow before anyone maps the attack surface.",
  },
  {
    icon: ShieldOff,
    title: "Traditional controls miss agent behavior",
    body: "Firewalls and IAM were built for human actors — not autonomous chains that improvise, lateralize, and exfiltrate through tools.",
  },
  {
    icon: AlertTriangle,
    title: "Red team and runtime live in different tools",
    body: "Campaign findings don't flow into containment playbooks, so the same vulnerability gets re-discovered every quarter.",
  },
  {
    icon: Zap,
    title: "Latency kills real containment",
    body: "Batch scanning after the fact can't enforce KILL or QUARANTINE at ingest — damage spreads in the same session.",
  },
] as const;

export function LandingProblem() {
  return (
    <section id="problem" className="px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <LandingSectionHeader
          badge="The gap"
          title="Traditional security wasn't built for agentic AI"
          description="Leading AI security vendors all converge on the same truth: you need runtime defense, adversarial testing, and governance in one lifecycle — not three disconnected dashboards."
          align="center"
          className="mx-auto max-w-3xl"
        />

        <motion.div
          className="mt-12 grid gap-4 sm:grid-cols-2"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
        >
          {PROBLEMS.map((item) => (
            <motion.article
              key={item.title}
              variants={fadeUp}
              transition={{ ease: easeOut }}
              className="landing-problem-card rounded-2xl border border-border/50 bg-card/25 p-5 sm:p-6"
            >
              <item.icon className="h-5 w-5 text-primary" aria-hidden />
              <h3 className="mt-4 text-base font-medium tracking-tight">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
