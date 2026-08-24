"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, FileSearch, GitBranch, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { easeOut, staggerContainer, fadeUp } from "@/lib/motionPresets";
import { demoHref } from "@/lib/demoRoutes";
import { LandingSectionHeader } from "./LandingSectionHeader";

const FINDING_ROWS = [
  {
    id: "F-2841",
    title: "Prompt injection via RAG context",
    severity: "CRITICAL" as const,
    source: "Red Team · campaign-07",
    status: "Promoted to playbook v3",
  },
  {
    id: "F-2836",
    title: "Lateral tool call to execute_system_command",
    severity: "HIGH" as const,
    source: "Runtime ingest",
    status: "Quarantined · autopsy ready",
  },
  {
    id: "F-2829",
    title: "Goal drift on customer-support agent",
    severity: "MEDIUM" as const,
    source: "Observatory drift detector",
    status: "Under review",
  },
] as const;

const SEVERITY_STYLES = {
  CRITICAL: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  HIGH: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  MEDIUM: "bg-sky-500/15 text-sky-400 border-sky-500/30",
} as const;

const HIGHLIGHTS = [
  {
    icon: FileSearch,
    title: "Unified severity language",
    body: "Runtime hits and campaign verdicts land in one registry — no reconciling three exports after every incident.",
  },
  {
    icon: GitBranch,
    title: "Playbook promotion",
    body: "One-click promote findings into versioned playbooks with full chain-of-custody for auditors.",
  },
  {
    icon: ShieldCheck,
    title: "Framework mapping",
    body: "Every finding tagged to OWASP LLM and MITRE ATLAS techniques for readiness exports.",
  },
] as const;

export function LandingFindingsSpotlight() {
  return (
    <section id="findings" className="px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <LandingSectionHeader
              badge="Findings"
              title="From detection to audit-ready evidence"
              description="The findings registry connects live containment, red-team campaigns, and governance — so security teams close the loop instead of re-discovering the same gaps."
            />

            <motion.div
              className="mt-8 space-y-3"
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              {HIGHLIGHTS.map((h) => (
                <motion.div
                  key={h.title}
                  variants={fadeUp}
                  transition={{ ease: easeOut }}
                  className="flex gap-3 rounded-xl border border-border/40 bg-card/20 p-4"
                >
                  <h.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <div>
                    <p className="text-sm font-medium">{h.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{h.body}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            <Button asChild className="mt-8 gap-2 rounded-full">
              <Link href={demoHref("findings")}>
                Try findings demo
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </div>

          <motion.div
            className="landing-findings-panel overflow-hidden rounded-2xl border border-border/50 bg-[#0B101E]/80 shadow-2xl backdrop-blur-xl"
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, ease: easeOut }}
          >
            <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
              <p className="font-mono text-xs text-muted-foreground">findings_registry</p>
              <span className="rounded-full bg-primary/15 px-2 py-0.5 font-mono text-[10px] text-primary">
                3 open · 1 promoted
              </span>
            </div>
            <div className="divide-y divide-border/30">
              {FINDING_ROWS.map((row, i) => (
                <motion.div
                  key={row.id}
                  className="px-4 py-3.5 transition-colors hover:bg-muted/10"
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.08 * i, ease: easeOut }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10px] text-muted-foreground">{row.id}</span>
                    <span
                      className={`rounded border px-1.5 py-0.5 font-mono text-[9px] ${SEVERITY_STYLES[row.severity]}`}
                    >
                      {row.severity}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm font-medium">{row.title}</p>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span>{row.source}</span>
                    <span className="text-foreground/70">→ {row.status}</span>
                  </div>
                </motion.div>
              ))}
            </div>
            <div className="border-t border-border/40 bg-muted/10 px-4 py-2.5 text-center">
              <Link
                href={demoHref("findings")}
                className="text-xs text-muted-foreground transition-colors hover:text-primary"
              >
                Try full findings demo →
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
