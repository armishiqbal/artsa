"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Cloud,
  FileJson,
  Plug,
  Radio,
  Server,
  Webhook,
} from "lucide-react";
import { easeOut, staggerContainer, fadeUp } from "@/lib/motionPresets";
import { demoHref } from "@/lib/demoRoutes";
import { LandingSectionHeader } from "./LandingSectionHeader";

const INTEGRATIONS = [
  { icon: Plug, name: "REST ingest API", detail: "POST /api/v1/ingest" },
  { icon: Radio, name: "Live WebSocket", detail: "Real-time observatory feed" },
  { icon: Server, name: "Provider registry", detail: "Groq, OpenAI, Anthropic, custom" },
  { icon: Webhook, name: "Campaign gateway", detail: "Red-team job orchestration" },
  { icon: FileJson, name: "Readiness exports", detail: "FYP & audit snapshots" },
  { icon: Cloud, name: "BFF proxy", detail: "Next.js API route to backend" },
] as const;

export function LandingIntegrations() {
  return (
    <section id="integrations" className="px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <LandingSectionHeader
          badge="Integration & scale"
          title="API-first deployment that scales with your stack"
          description="Like Lakera's cloud-native architecture and HiddenLayer's CI/CD hooks — wire ARTSA into ingest, providers, and export pipelines without rip-and-replace."
          align="center"
          className="mx-auto max-w-3xl"
        />

        <motion.div
          className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {INTEGRATIONS.map((item) => (
            <motion.div
              key={item.name}
              variants={fadeUp}
              transition={{ ease: easeOut }}
              className="flex gap-4 rounded-xl border border-border/50 bg-card/20 p-4"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/20">
                <item.icon className="h-5 w-5 text-primary" aria-hidden />
              </div>
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">{item.detail}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          <Link href="/get-started" className="text-foreground underline-offset-4 hover:underline">
            Setup guide & integrations
          </Link>
          {" · "}
          <Link href={demoHref("guard")} className="text-foreground underline-offset-4 hover:underline">
            Try live demo
          </Link>
        </p>
      </div>
    </section>
  );
}
