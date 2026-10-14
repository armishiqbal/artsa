"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Terminal, Calendar } from "lucide-react";
import { easeOut } from "@/lib/motionPresets";
import { demoHref } from "@/lib/demoRoutes";
import { LandingHeroSimulator } from "./LandingHeroSimulator";
import { LandingContactSalesButton } from "./LandingContactSalesButton";

export function LandingHero() {
  return (
    <section className="relative overflow-hidden pt-12 pb-16 sm:pt-20 sm:pb-24">
      <div className="lp-shell">
        {/* Enterprise Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: easeOut }}
          className="mx-auto max-w-4xl text-center"
        >
          {/* Beacon Pill Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/80 bg-blue-50 px-4 py-1.5 text-[12px] font-mono font-medium text-blue-700 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-600" />
            </span>
            <span className="tracking-wide">ARTSA · AI AGENT SECURITY WORKFLOWS</span>
          </div>

          {/* Signature Headline */}
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl md:text-6xl text-balance">
            Secure the Actions Your Users and AI Agents{" "}
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent">
              Execute Across Your Apps.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mx-auto mt-6 max-w-2xl text-base text-slate-600 sm:text-lg sm:leading-relaxed">
            ARTSA connects campaign execution, agent actions, and recorded security evidence so teams
            can inspect what ran and what the backend confirmed.
          </p>

          {/* Dual Action Pathways */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            <LandingContactSalesButton
              variant="ghost"
              className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-sm font-mono font-semibold text-white shadow-md shadow-blue-500/10 transition hover:bg-blue-700"
            >
              <Calendar className="h-4 w-4" />
              Schedule a demo
            </LandingContactSalesButton>
            <Link
              href={demoHref("guard")}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-mono font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 hover:border-slate-400"
            >
              Explore interactive sandbox
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <a
              href="#simulator"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100/80 px-4 py-2.5 text-xs font-mono font-medium text-slate-700 transition hover:bg-slate-200"
            >
              <Terminal className="h-3.5 w-3.5 text-blue-600" />
              Explore interactive sample ↓
            </a>
          </div>

          <p className="mx-auto mt-6 max-w-2xl text-xs font-mono text-slate-500">
            The public sandbox uses labeled sample scenarios. Operational screens load backend records.
          </p>
        </motion.div>

        {/* Intelligence Console Centerpiece */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.6, ease: easeOut }}
        >
          <LandingHeroSimulator />
        </motion.div>
      </div>
    </section>
  );
}
