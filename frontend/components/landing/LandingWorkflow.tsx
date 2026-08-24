"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { easeOut, staggerContainer, fadeUp } from "@/lib/motionPresets";
import { LandingMotionCard } from "./LandingMotionCard";
import { LandingSectionHeader } from "./LandingSectionHeader";

const STEPS = [
  {
    step: "01",
    title: "Connect agents",
    body: "Point your LLM stack at ARTSA ingest with a snippet or SDK. Telemetry flows in without changing your agent runtime.",
  },
  {
    step: "02",
    title: "Observe & contain",
    body: "The command center scores every session layer, surfaces severity at a glance, and triggers containment actions on policy breach.",
  },
  {
    step: "03",
    title: "Stress with red team",
    body: "Launch campaigns from the Red Team Console — attack templates, target configs, and LLM judge verdicts in one workspace.",
  },
  {
    step: "04",
    title: "Harden & export",
    body: "Promote findings to playbooks, track policy versions, and ship readiness snapshots to auditors and stakeholders.",
  },
] as const;

export function LandingWorkflow({ id = "workflow" }: { id?: string }) {
  return (
    <section id={id} className="px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <LandingSectionHeader
            badge="How it works"
            title="From ingest to hardened playbook"
            className="mb-0 max-w-xl"
          />
          <Button asChild variant="outline" className="gap-2 shrink-0 rounded-full">
            <Link href="/get-started">
              Setup guide
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </div>

        <motion.div
          className="grid gap-4 md:grid-cols-2"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
        >
          {STEPS.map((item, i) => (
            <motion.div key={item.step} variants={fadeUp} transition={{ ease: easeOut }}>
              <LandingMotionCard
                index={i}
                className="landing-workflow-step flex gap-4 p-5"
              >
                <motion.span
                  className="font-mono text-sm font-semibold text-primary"
                  whileHover={{ scale: 1.15 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  {item.step}
                </motion.span>
                <div>
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {item.body}
                  </p>
                </div>
              </LandingMotionCard>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
