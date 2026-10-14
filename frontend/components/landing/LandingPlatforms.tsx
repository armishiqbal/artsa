"use client";

import Link from "next/link";
import { ArrowRight, Activity, FileSearch, Shield, Swords } from "lucide-react";
import { motion } from "framer-motion";
import { easeOut, fadeUp, staggerContainer } from "@/lib/motionPresets";
import { demoHref, type DemoTab } from "@/lib/demoRoutes";

const WORKFLOWS: {
  number: string;
  name: string;
  label: string;
  description: string;
  tab: DemoTab;
  icon: typeof Shield;
}[] = [
  {
    number: "01",
    name: "Runtime guard",
    label: "Enforce",
    description:
      "Gate supported requests with explicit ALLOW, QUARANTINE, or BLOCK decisions.",
    tab: "guard",
    icon: Shield,
  },
  {
    number: "02",
    name: "Red Team",
    label: "Test",
    description:
      "Run adversarial campaigns, compare rounds, and inspect Judge outcomes.",
    tab: "redteam",
    icon: Swords,
  },
  {
    number: "03",
    name: "Command Center",
    label: "Coordinate",
    description:
      "Review agent health, campaign activity, and detection-rate trends in one workspace.",
    tab: "command",
    icon: Activity,
  },
  {
    number: "04",
    name: "Findings & replay",
    label: "Investigate",
    description:
      "Trace campaign findings and inspect recorded session evidence for follow-up.",
    tab: "findings",
    icon: FileSearch,
  },
];

export function LandingPlatforms() {
  return (
    <section id="platforms" className="lp-section scroll-mt-24">
      <div className="lp-shell">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, ease: easeOut }}
          className="max-w-3xl"
        >
          <p className="lp-eyebrow">Product</p>
          <h2 className="lp-heading mt-5">One control plane. Clear security jobs.</h2>
          <p className="lp-body mt-4">
            Move from a controlled test to an enforced decision, then keep the evidence close to
            the people who need to act on it.
          </p>
        </motion.div>

        <motion.div
          className="lp-workflow-grid mt-11 grid sm:grid-cols-2"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {WORKFLOWS.map((workflow) => {
            const Icon = workflow.icon;
            return (
              <motion.article
                key={workflow.number}
                variants={fadeUp}
                transition={{ ease: easeOut }}
                className="lp-workflow-item"
              >
                <div className="flex items-center gap-3">
                  <span className="lp-mono text-[12px] tracking-[0.1em] text-[var(--color-pistachio)]">
                    {workflow.number}
                  </span>
                  <span className="h-px flex-1 bg-[var(--color-steel-border)]" />
                  <Icon className="h-4 w-4 text-[var(--color-pistachio)]" aria-hidden />
                </div>
                <p className="lp-mono mt-5 text-[11px] uppercase tracking-[0.12em] text-[var(--color-fog)]">
                  {workflow.label}
                </p>
                <h3 className="lp-heading-sm mt-2">{workflow.name}</h3>
                <p className="lp-body-sm mt-3 max-w-md">{workflow.description}</p>
                <Link
                  href={demoHref(workflow.tab)}
                  className="lp-platform-link mt-5 inline-flex items-center gap-2"
                >
                  Explore workflow <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </motion.article>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
