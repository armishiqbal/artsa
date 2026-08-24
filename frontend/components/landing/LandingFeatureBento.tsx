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
import { easeOut, staggerContainer } from "@/lib/motionPresets";
import { demoHref } from "@/lib/demoRoutes";
import { LandingMotionCard } from "./LandingMotionCard";

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
    title: "Runtime guard",
    body: "Sub-50ms tool-call scoring with ALLOW, QUARANTINE, or KILL.",
    href: demoHref("guard"),
    tag: "Core",
    className: "md:col-span-2 md:row-span-2",
    large: true,
  },
  {
    icon: Crosshair,
    title: "Red team console",
    body: "Coverage grids and judge verdicts.",
    href: demoHref("redteam"),
    tag: "Attack",
    className: "",
  },
  {
    icon: FileSearch,
    title: "Findings registry",
    body: "Chain-of-custody and playbook promotion.",
    href: demoHref("findings"),
    tag: "Govern",
    className: "",
  },
  {
    icon: Rewind,
    title: "Session autopsy",
    body: "Film timeline and layer forensics.",
    href: demoHref("replay"),
    tag: "Forensics",
    className: "",
  },
  {
    icon: Network,
    title: "Swarm containment",
    body: "Map agent topologies and lateral tool paths.",
    href: demoHref("pipeline"),
    tag: "Agents",
    className: "",
  },
  {
    icon: Zap,
    title: "Fast fallback",
    body: "Predictable failure modes when backends are unreachable.",
    href: demoHref("guard"),
    tag: "SRE",
    className: "",
  },
  {
    icon: Layers,
    title: "Layered detection",
    body: "Semantic, policy, and behavioral layers into one verdict.",
    href: demoHref("guard"),
    tag: "Engine",
    className: "",
  },
  {
    icon: GitBranch,
    title: "Playbook promotion",
    body: "Turn red team hits into versioned enforcement rules.",
    href: "/admin/policies",
    tag: "Policy",
    className: "",
  },
  {
    icon: Activity,
    title: "Live observatory",
    body: "Streaming telemetry, latency budgets, and live sessions.",
    href: demoHref("command"),
    tag: "Observe",
    className: "md:col-span-2",
    large: true,
  },
];

export function LandingFeatureBento() {
  return (
    <section id="features" className="px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Architecture
          </p>
          <h2 className="mt-2 text-2xl font-medium tracking-tight sm:text-3xl md:text-4xl">
            Built for security teams shipping agentic AI
          </h2>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            Every layer from ingest to post-incident forensics, unified in one platform.
          </p>
        </div>

        <motion.div
          className="mt-10 grid gap-3 sm:grid-cols-2 md:grid-cols-3 md:auto-rows-[minmax(140px,auto)]"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
        >
          {CARDS.map((card, i) => (
            <Link
              key={card.title}
              href={card.href}
              className={`block h-full ${card.className}`}
            >
              <LandingMotionCard index={i} className="h-full p-5 sm:p-6">
                <div className="flex h-full flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <motion.div
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary"
                      whileHover={{ rotate: [0, -8, 8, 0], scale: 1.08 }}
                      transition={{ duration: 0.45 }}
                    >
                      <card.icon className="h-4 w-4" aria-hidden />
                    </motion.div>
                    <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                      {card.tag}
                    </span>
                  </div>
                  <h3 className={`mt-4 font-medium tracking-tight ${card.large ? "text-lg sm:text-xl" : "text-base"}`}>
                    {card.title}
                  </h3>
                  <p className={`mt-2 text-muted-foreground ${card.large ? "text-sm sm:text-base" : "text-sm"}`}>
                    {card.body}
                  </p>
                  <span className="mt-auto pt-4 text-xs text-muted-foreground transition-colors group-hover:text-primary">
                    Open in demo →
                  </span>
                </div>
              </LandingMotionCard>
            </Link>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
