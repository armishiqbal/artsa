"use client";

import Link from "next/link";
import { ArrowRight, Braces, Cable, Server, Cpu, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import { easeOut, staggerContainer, fadeUp } from "@/lib/motionPresets";
import { demoHref } from "@/lib/demoRoutes";

const BOUNDARIES = [
  {
    icon: Server,
    tag: "Proxy integration",
    name: "LLM Provider Reverse Proxy",
    protocol: "HTTP / SSE Streaming Proxy",
    timing: "Boundary: provider request and response path",
    detail:
      "Configure a supported provider path through the proxy and verify the deployed policy behavior. Provider credentials and connectivity must be configured for your environment.",
    action: "Explore Guard Controls",
    href: demoHref("guard"),
  },
  {
    icon: Braces,
    tag: "SDK integration",
    name: "Python & TypeScript SDK Wrappers",
    protocol: "pip install artsa · npm i @artsa/sdk",
    timing: "Tool boundary: In-memory argument & return validation",
    detail:
      "Python and TypeScript clients expose tool-call evaluation methods. Your agent runtime must keep the actual tool execution behind the returned decision; callback integrations may be observational.",
    action: "Read SDK Quickstart",
    href: "/get-started",
  },
  {
    icon: Cable,
    tag: "Bounded MCP support",
    name: "Model Context Protocol (MCP)",
    protocol: "Stdio wrapper and scoped HTTP paths",
    timing: "Boundary behavior depends on transport",
    detail:
      "The local stdio wrapper can mediate a configured server. HTTP inspection is detect-only, and managed GitHub HTTP support is limited to its catalog; arbitrary third-party HTTP forwarding is not a live capability.",
    action: "View MCP Setup",
    href: "/get-started",
  },
] as const;

export function LandingBoundaries() {
  return (
    <section id="integrations" className="lp-section scroll-mt-24 border-t border-slate-200/80 bg-white py-20 sm:py-28">
      <div className="lp-shell">
        <motion.div
          className="mx-auto max-w-3xl text-center"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, ease: easeOut }}
        >
          <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-mono font-medium text-blue-700 mb-3 shadow-xs">
            <Cpu className="h-3.5 w-3.5" />
            INTEGRATION BOUNDARIES
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
            Attach Where Your Agents Actually Execute
          </h2>
          <p className="mt-4 text-base text-slate-600 sm:text-lg">
            ARTSA exposes several integration boundaries. Confirm the behavior for your selected SDK, provider, transport, and runtime before relying on enforcement.
          </p>
        </motion.div>

        <motion.div
          className="mt-14 grid gap-6 md:grid-cols-3"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {BOUNDARIES.map((b) => {
            const Icon = b.icon;
            return (
              <motion.div
                key={b.name}
                variants={fadeUp}
                transition={{ ease: easeOut }}
                className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xs transition-all hover:border-blue-300 hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-mono font-medium text-slate-600">
                      {b.tag}
                    </span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-100 bg-blue-50/80 text-blue-600 transition-transform group-hover:scale-105">
                      <Icon className="h-4.5 w-4.5" aria-hidden />
                    </div>
                  </div>

                  <h3 className="mt-5 text-lg font-semibold tracking-tight text-slate-900">
                    {b.name}
                  </h3>

                  <div className="mt-2.5 inline-block rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[11px] font-medium text-slate-700">
                    {b.protocol}
                  </div>

                  <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/50 px-2.5 py-1.5 text-xs font-mono text-blue-800 flex items-center gap-1.5">
                    <CheckCircle className="h-3.5 w-3.5 shrink-0 text-blue-600" />
                    <span>{b.timing}</span>
                  </div>

                  <p className="mt-3.5 text-sm leading-relaxed text-slate-600">
                    {b.detail}
                  </p>
                </div>

                <div className="mt-8 border-t border-slate-100 pt-4">
                  <Link
                    href={b.href}
                    className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-blue-600 transition-colors hover:text-blue-800"
                  >
                    {b.action} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
