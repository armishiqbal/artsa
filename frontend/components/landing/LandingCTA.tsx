"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Terminal, Shield, Zap } from "lucide-react";
import { easeOut } from "@/lib/motionPresets";
import { demoHref } from "@/lib/demoRoutes";
import { LandingSignInButton } from "./LandingSignInButton";
import { LandingContactSalesButton } from "./LandingContactSalesButton";

export function LandingCTA() {
  return (
    <section className="relative overflow-hidden border-t border-slate-200/80 bg-white py-20 sm:py-28">
      {/* Background Soft Radial Ambient */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-60" aria-hidden="true">
        <div className="h-[420px] w-[750px] rounded-full bg-gradient-to-r from-blue-100/60 via-indigo-50/50 to-sky-100/60 blur-3xl" />
      </div>

      <div className="lp-shell relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: easeOut }}
          className="mx-auto max-w-4xl rounded-3xl border border-blue-200/80 bg-gradient-to-b from-blue-50/70 to-white p-8 sm:p-12 md:p-16 text-center shadow-lg"
        >
          <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-white px-3.5 py-1 text-xs font-mono font-medium text-blue-700 mb-4 shadow-xs">
            <Zap className="h-3.5 w-3.5" />
            ZERO ACCOUNT REQUIRED FOR INTERACTIVE SANDBOX
          </div>

          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
            Evaluate the Agent Security Workflow
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">
            Explore the labeled sandbox, or connect an authenticated backend and configured provider to evaluate your own workflow.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            <Link
              href={demoHref("guard")}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition-colors hover:bg-blue-700"
            >
              Launch interactive sandbox
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <LandingContactSalesButton
              variant="ghost"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 shadow-xs transition-colors hover:bg-slate-50 hover:border-slate-400"
            >
              Book architecture review
            </LandingContactSalesButton>
            <LandingSignInButton
              variant="ghost"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-mono font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
              signInOptions={{ returnTo: "/command-center", mode: "register" }}
            >
              <Terminal className="h-3.5 w-3.5 text-blue-600" />
              Sign up free
            </LandingSignInButton>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs font-mono text-slate-500 border-t border-slate-200/80 pt-6">
            <span className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-blue-600" />
              Sandbox uses sample data
            </span>
            <span>·</span>
            <span>Open Source SDKs Available</span>
            <span>·</span>
            <span>Configure and verify integrations before relying on enforcement</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
