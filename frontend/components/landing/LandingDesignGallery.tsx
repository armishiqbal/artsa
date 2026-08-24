"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  ArrowUpRight,
  Crosshair,
  ExternalLink,
  FileSearch,
  Layers,
  Palette,
  Rewind,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/shared/SegmentedControl";
import { easeOut, staggerContainer, fadeUp } from "@/lib/motionPresets";
import { cn } from "@/lib/utils";
import { demoHref } from "@/lib/demoRoutes";
import { LandingProductScreenshot, type ProductScreenId } from "./LandingProductScreenshots";
import { LandingSectionHeader } from "./LandingSectionHeader";

const LANDBOOK_URL =
  "https://landbook.co/?search=saas%20dashboard%20dark";

type GalleryCategory = "all" | "command" | "findings" | "redteam" | "replay" | "pipeline";

const FILTER_OPTIONS: { value: GalleryCategory; label: string }[] = [
  { value: "all", label: "All screens" },
  { value: "command", label: "Command Center" },
  { value: "findings", label: "Findings" },
  { value: "redteam", label: "Red Team" },
  { value: "replay", label: "Replay" },
  { value: "pipeline", label: "Pipeline" },
];

interface ShowcaseItem {
  id: string;
  category: Exclude<GalleryCategory, "all">;
  title: string;
  description: string;
  href: string;
  tag: string;
  accent: string;
  icon: typeof Activity;
  preview: ProductScreenId;
}

const SHOWCASE: ShowcaseItem[] = [
  {
    id: "command",
    category: "command",
    title: "Command Center",
    description: "Live KPIs, threat matrix, and containment SLO at a glance.",
    href: demoHref("command"),
    tag: "Monitor",
    accent: "from-primary/20 to-transparent",
    icon: Activity,
    preview: "command",
  },
  {
    id: "findings",
    category: "findings",
    title: "Findings Registry",
    description: "Severity-ranked hits with chain-of-custody and playbook promotion.",
    href: demoHref("findings"),
    tag: "Govern",
    accent: "from-rose-500/15 to-transparent",
    icon: FileSearch,
    preview: "findings",
  },
  {
    id: "redteam",
    category: "redteam",
    title: "Red Team Console",
    description: "Coverage grids, judge verdicts, and adversarial scan metrics.",
    href: demoHref("redteam"),
    tag: "Attack",
    accent: "from-amber-500/15 to-transparent",
    icon: Crosshair,
    preview: "redteam",
  },
  {
    id: "replay",
    category: "replay",
    title: "Session Autopsy",
    description: "Film timeline, layer scores, and forensics for every containment event.",
    href: demoHref("replay"),
    tag: "Investigate",
    accent: "from-emerald-500/15 to-transparent",
    icon: Rewind,
    preview: "replay",
  },
  {
    id: "pipeline",
    category: "pipeline",
    title: "Agent Pipeline DAG",
    description: "Multi-agent topology with live status strips and lateral call tracing.",
    href: demoHref("pipeline"),
    tag: "Topology",
    accent: "from-sky-500/15 to-transparent",
    icon: Layers,
    preview: "pipeline",
  },
];

export function LandingDesignGallery() {
  const [filter, setFilter] = useState<GalleryCategory>("all");

  const visible = useMemo(
    () => (filter === "all" ? SHOWCASE : SHOWCASE.filter((s) => s.category === filter)),
    [filter]
  );

  return (
    <section id="design" className="border-y border-border/40 px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <LandingSectionHeader
          badge="Product design"
          title="Explore the command center — product screenshots"
          description="High-fidelity previews of every ARTSA surface — filter by workflow, open any screen, or browse similar SaaS dashboards on Landbook."
          align="center"
          className="mx-auto max-w-3xl"
        />

        <div className="mt-8 flex flex-col items-center justify-between gap-4 sm:flex-row">
          <SegmentedControl
            options={FILTER_OPTIONS}
            value={filter}
            onChange={setFilter}
            layoutId="landing-design-filter"
            className="max-w-full overflow-x-auto"
          />
          <Button asChild variant="outline" size="sm" className="shrink-0 gap-2 rounded-full">
            <a href={LANDBOOK_URL} target="_blank" rel="noopener noreferrer">
              <Palette className="h-3.5 w-3.5" aria-hidden />
              Find on Landbook
              <ExternalLink className="h-3 w-3 opacity-60" aria-hidden />
            </a>
          </Button>
        </div>

        <motion.div
          className="landing-design-gallery mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
        >
          <AnimatePresence mode="popLayout">
            {visible.map((item) => (
              <motion.div
                key={item.id}
                layout
                variants={fadeUp}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ ease: easeOut }}
              >
                <Link
                  href={item.href}
                  className="landing-design-card group block h-full overflow-hidden rounded-2xl border border-border/50 bg-card/30 transition-all duration-300 hover:border-border/80 hover:shadow-xl hover:shadow-foreground/5"
                >
                  <div
                    className={cn(
                      "landing-design-card__preview relative overflow-hidden border-b border-border/40 bg-gradient-to-b",
                      item.accent
                    )}
                  >
                    <div className="landing-browser__toolbar flex items-center gap-2 px-3 py-2">
                      <div className="flex gap-1">
                        <span className="landing-browser__dot bg-rose-500/70" />
                        <span className="landing-browser__dot bg-amber-500/70" />
                        <span className="landing-browser__dot bg-emerald-500/70" />
                      </div>
                      <span className="flex-1 truncate text-center font-mono text-[10px] text-muted-foreground">
                        artsa.app{item.href}
                      </span>
                    </div>
                    <LandingProductScreenshot screen={item.preview} />
                    <div className="absolute inset-0 bg-gradient-to-t from-card/80 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <div className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-2">
                      <item.icon className="h-4 w-4 text-primary" aria-hidden />
                      <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                        {item.tag}
                      </span>
                    </div>
                    <h3 className="mt-2 text-base font-medium tracking-tight group-hover:text-primary">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                    <span className="mt-3 flex items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground">
                      Try in demo
                      <ArrowUpRight className="h-3 w-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
}
