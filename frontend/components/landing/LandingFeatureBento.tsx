"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Activity,
  Crosshair,
  FileSearch,
  GitBranch,
  Layers,
  Network,
  Rewind,
  Shield,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { staggerContainer } from "@/lib/motionPresets";
import { demoHref } from "@/lib/demoRoutes";

interface BentoCard {
  icon: LucideIcon;
  title: string;
  body: string;
  href: string;
  tag: string;
  className: string;
  large?: boolean;
}

const CARDS: BentoCard[] = [
  {
    icon: Shield,
    title: "Runtime Guard (EDS)",
    body: "Submit tool-call events for policy evaluation and review the backend response before your runtime proceeds.",
    href: demoHref("guard"),
    tag: "Inline Defense",
    className: "md:col-span-2 md:row-span-2",
    large: true,
  },
  {
    icon: Crosshair,
    title: "Red Team Console",
    body: "Run configured adversarial campaigns and inspect their recorded rounds and judge evaluations.",
    href: demoHref("redteam"),
    tag: "Attack",
    className: "",
  },
  {
    icon: FileSearch,
    title: "Findings Registry",
    body: "Review backend findings, recorded custody fields, and the playbook suggestion workflow.",
    href: demoHref("findings"),
    tag: "Govern",
    className: "",
  },
  {
    icon: Rewind,
    title: "Session Replay & Evidence",
    body: "Inspect recorded event arguments, tool responses, and backend evaluations for a selected session.",
    href: demoHref("replay"),
    tag: "Forensics",
    className: "",
  },
  {
    icon: Network,
    title: "Swarm Containment",
    body: "View recorded agent handoffs and request supported actions against the selected session.",
    href: demoHref("pipeline"),
    tag: "Swarm DAG",
    className: "",
  },
  {
    icon: Zap,
    title: "Fast Fallback SRE",
    body: "Deterministic, predictable fail-closed and fail-open policies when backends degrade.",
    href: demoHref("guard"),
    tag: "SRE Reliability",
    className: "",
  },
  {
    icon: Layers,
    title: "Layered Detection",
    body: "Semantic embeddings, regex AST rules, and behavioral heuristics fused into one score.",
    href: demoHref("guard"),
    tag: "Engine",
    className: "",
  },
  {
    icon: GitBranch,
    title: "Playbook Promotion",
    body: "Create a reviewable playbook suggestion from a finding; deployment requires a separate policy workflow.",
    href: "/admin/policies",
    tag: "Policy",
    className: "",
  },
  {
    icon: Activity,
    title: "Live Observatory",
    body: "Review telemetry and session records returned by the connected backend.",
    href: demoHref("command"),
    tag: "Observability",
    className: "md:col-span-2",
    large: true,
  },
];

export function LandingFeatureBento() {
  return (
    <section id="features" className="scroll-mt-24 border-b border-slate-100 bg-white px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200/80 bg-blue-50 px-3.5 py-1 text-xs font-mono font-medium text-blue-700 mb-3 shadow-xs">
            <Layers className="h-3.5 w-3.5" />
            UNIFIED PLATFORM CAPABILITIES
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
            Security Workflows for Agent Systems
          </h2>
          <p className="mt-4 text-base text-slate-600 sm:text-lg">
            Review events, campaign results, and session evidence. Verify provider connectivity and runtime enforcement in your own deployment.
          </p>
        </div>

        <motion.div
          className="mt-14 grid gap-4 sm:grid-cols-2 md:grid-cols-3 md:auto-rows-[minmax(140px,auto)]"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
        >
          {CARDS.map((card) => (
            <Link
              key={card.title}
              href={card.href}
              className={`group block h-full rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs transition-all hover:border-blue-400 hover:shadow-md ${card.className}`}
            >
              <div className="flex h-full flex-col">
                <div className="flex items-start justify-between gap-2">
                  <motion.div
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700 transition-transform group-hover:scale-105"
                  >
                    <card.icon className="h-5 w-5" aria-hidden />
                  </motion.div>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-mono text-slate-600 font-medium">
                    {card.tag}
                  </span>
                </div>
                <h3 className={`mt-4 font-semibold text-slate-900 tracking-tight ${card.large ? "text-xl sm:text-2xl" : "text-base"}`}>
                  {card.title}
                </h3>
                <p className={`mt-2 text-slate-600 leading-relaxed ${card.large ? "text-sm sm:text-base" : "text-sm"}`}>
                  {card.body}
                </p>
                <span className="mt-auto pt-4 text-xs font-mono font-semibold text-blue-600 transition-colors group-hover:text-blue-800">
                  Open in demo →
                </span>
              </div>
            </Link>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
