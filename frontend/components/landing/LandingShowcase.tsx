"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { easeOut } from "@/lib/motionPresets";
import { demoHref, type DemoTab } from "@/lib/demoRoutes";
import { LandingProductScreenshot } from "./LandingProductScreenshots";
import { cn } from "@/lib/utils";

const TABS: { id: DemoTab; label: string; title: string; description: string }[] = [
  {
    id: "guard",
    label: "Runtime guard",
    title: "Score every tool call in milliseconds",
    description: "Layered inspectors block prompt injection, SQL abuse, and lateral shell commands before execution.",
  },
  {
    id: "redteam",
    label: "Red team",
    title: "Adversarial scans with coverage grids",
    description: "Run campaigns, map bypasses, and feed verdicts straight into your findings registry.",
  },
  {
    id: "findings",
    label: "Findings",
    title: "One severity language end to end",
    description: "Promote hits into versioned playbooks with chain-of-custody for auditors and GRC teams.",
  },
  {
    id: "replay",
    label: "Replay",
    title: "Session autopsy with layer forensics",
    description: "Film timeline and trajectory strips when containment fires — full context for SOC escalation.",
  },
];

export function LandingShowcase() {
  const [active, setActive] = useState<DemoTab>("guard");
  const tab = TABS.find((t) => t.id === active) ?? TABS[0];
  const screenMap = {
    guard: "command",
    redteam: "redteam",
    findings: "findings",
    replay: "replay",
    command: "command",
    pipeline: "pipeline",
  } as const;
  const screen = screenMap[active];

  return (
    <section id="product" className="lp-section border-t border-border/40">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-primary">Product</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Built for the full agent security lifecycle
          </h2>
          <p className="mt-4 text-muted-foreground">
            Monitor, contain, attack-test, and govern — without switching between disconnected tools.
          </p>
        </div>

        <div className="mt-10 flex flex-wrap gap-2" role="tablist" aria-label="Product areas">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active === t.id}
              onClick={() => setActive(t.id)}
              className={cn(
                "rounded-lg border px-4 py-2 text-sm transition-colors",
                active === t.id
                  ? "border-border bg-foreground text-background"
                  : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-8 grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.35, ease: easeOut }}
            >
              <h3 className="text-xl font-medium sm:text-2xl">{tab.title}</h3>
              <p className="mt-3 leading-relaxed text-muted-foreground">{tab.description}</p>
              <Button asChild className="mt-6 rounded-lg gap-2">
                <Link href={demoHref(active)}>
                  Try in demo
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
            </motion.div>
          </AnimatePresence>

          <motion.div
            key={`preview-${active}`}
            initial={{ opacity: 0, scale: 0.96, rotateY: -4 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            transition={{ duration: 0.45, ease: easeOut }}
            className="overflow-hidden rounded-xl border border-border/60 bg-card/30 shadow-xl shadow-primary/5"
          >
            <LandingProductScreenshot screen={screen} className="h-auto min-h-[16rem] rounded-none border-0" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
