"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, FileSearch, GitBranch, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { easeOut, staggerContainer, fadeUp } from "@/lib/motionPresets";
import { demoHref } from "@/lib/demoRoutes";

const FINDING_ROWS = [
  {
    id: "F-2841",
    title: "Prompt injection via RAG retrieval context",
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
    title: "Goal drift on customer-support triage agent",
    severity: "MEDIUM" as const,
    source: "Observatory drift detector",
    status: "Under review",
  },
] as const;

const SEVERITY_STYLES = {
  CRITICAL: "bg-rose-50 text-rose-700 border-rose-200",
  HIGH: "bg-amber-50 text-amber-700 border-amber-200",
  MEDIUM: "bg-sky-50 text-sky-700 border-sky-200",
} as const;

const HIGHLIGHTS = [
  {
    icon: FileSearch,
    title: "Unified Severity Language",
    body: "Review findings returned by the backend and inspect their recorded source and evaluation fields.",
  },
  {
    icon: GitBranch,
    title: "Playbook Suggestion Workflow",
    body: "Create a reviewable playbook suggestion from a finding. Treat deployment and enforcement as separate steps.",
  },
  {
    icon: ShieldCheck,
    title: "Framework Mapping & Exports",
    body: "Display framework mappings when they are present in a backend finding; a mapping is not a compliance certification.",
  },
] as const;

export function LandingFindingsSpotlight() {
  return (
    <section id="findings" className="scroll-mt-24 border-b border-slate-200 bg-slate-50/70 py-20 sm:py-28">
      <div className="lp-shell">
        <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200/80 bg-blue-50 px-3.5 py-1 text-xs font-mono font-medium text-blue-700 mb-3 shadow-xs">
              <FileSearch className="h-3.5 w-3.5" />
              FINDINGS REGISTRY &amp; GOVERNANCE
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              From Detection to Audit-Ready Evidence
            </h2>
            <p className="mt-4 text-base text-slate-600 leading-relaxed">
              The findings registry brings recorded findings, campaign evidence, and review workflows together.
              Use the authenticated workspace to inspect records returned for your tenant.
            </p>

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
                  className="flex gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700">
                    <h.icon className="h-4 w-4" aria-hidden />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{h.title}</p>
                    <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">{h.body}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            <Button asChild className="mt-8 gap-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-mono text-xs px-6 py-2.5 shadow-sm">
              <Link href={demoHref("findings")}>
                Try findings demo
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </div>

          <motion.div
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md"
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, ease: easeOut }}
          >
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
              <p className="font-mono text-xs font-semibold text-slate-700">findings_registry.audit</p>
              <span className="rounded-full bg-amber-50 px-2.5 py-0.5 font-mono text-[10px] text-amber-800 font-semibold border border-amber-200">
                ILLUSTRATIVE SAMPLE
              </span>
            </div>
            <p className="border-b border-slate-100 bg-amber-50 px-4 py-2 text-center font-mono text-[10px] text-amber-900">
              Example records only · not live customer findings or telemetry
            </p>
            <div className="divide-y divide-slate-100">
              {FINDING_ROWS.map((row, i) => (
                <motion.div
                  key={row.id}
                  className="px-5 py-4 transition-colors hover:bg-slate-50/70"
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.08 * i, ease: easeOut }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] text-slate-500 font-semibold">{row.id}</span>
                    <span
                      className={`rounded border px-2 py-0.5 font-mono text-[9px] font-bold ${SEVERITY_STYLES[row.severity]}`}
                    >
                      {row.severity}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm font-semibold text-slate-900">{row.title}</p>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500 font-mono">
                    <span>{row.source}</span>
                    <span className="text-emerald-700 font-semibold">→ {row.status}</span>
                  </div>
                </motion.div>
              ))}
            </div>
            <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-center">
              <Link
                href={demoHref("findings")}
                className="text-xs font-mono font-semibold text-blue-600 transition-colors hover:text-blue-800"
              >
                Explore labeled findings walkthrough →
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
