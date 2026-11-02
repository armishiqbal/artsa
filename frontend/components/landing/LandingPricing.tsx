"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, ShieldCheck, Zap, Lock, Sparkles } from "lucide-react";
import { easeOut, staggerContainer, fadeUp } from "@/lib/motionPresets";
import { LandingSignInButton } from "./LandingSignInButton";
import { LandingContactSalesButton } from "./LandingContactSalesButton";

interface PlanTier {
  name: string;
  badge?: string;
  description: string;
  monthlyPrice: string;
  annualPrice: string;
  periodNote: string;
  features: readonly string[];
  cta: string;
  isPopular?: boolean;
  isContact?: boolean;
}

const PLANS: readonly PlanTier[] = [
  {
    name: "Developer",
    badge: "Free Tier",
    description: "For solo engineers and pre-production agent prototypes.",
    monthlyPrice: "$0",
    annualPrice: "$0",
    periodNote: "Free forever · No credit card",
    features: [
      "Up to 25,000 monthly guarded tool calls",
      "Python and TypeScript SDK client wrappers",
      "Model Context Protocol (MCP) stdio boundary",
      "Deterministic sub-10ms fail-closed protection",
      "Community GitHub and Discord support",
    ],
    cta: "Start free sandbox",
  },
  {
    name: "Team",
    badge: "Enterprise Standard",
    description: "For engineering teams shipping autonomous agent fleets in production.",
    monthlyPrice: "$599",
    annualPrice: "$499",
    periodNote: "per month · billed annually ($1,200 savings)",
    features: [
      "500,000 monthly guarded tool calls",
      "Multi-agent swarm execution tracing & ITDR",
      "Automated continuous red team attack scans",
      "Cryptographic HMAC audit trail & forensic replay",
      "OWASP ASI01–ASI10 compliance matrix export",
      "Dedicated Slack bridge & 99.9% uptime SLA",
    ],
    cta: "Deploy Team tier",
    isPopular: true,
  },
  {
    name: "Enterprise",
    badge: "Air-Gapped & VPC",
    description: "For regulated industries, defense, and high-volume agent fleets.",
    monthlyPrice: "Custom",
    annualPrice: "Custom",
    periodNote: "Volume-based · Custom SLA",
    features: [
      "Unlimited agent fleets & guarded tool calls",
      "Self-hosted VPC & air-gapped on-premise deployment",
      "Role-Based Access Control (RBAC) & SAML 2.0 / OIDC SSO",
      "Custom threat heuristics & private LLM judges",
      "Audit-ready exports (ISO 42001, NIST AI RMF, SOC 2)",
      "24/7 dedicated security engineering hotline",
    ],
    cta: "Request Architecture Demo",
    isContact: true,
  },
] as const;

export function LandingPricing() {
  const [billingCycle, setBillingCycle] = useState<"annual" | "monthly">("annual");

  return (
    <section id="pricing" className="lp-section scroll-mt-24 border-t border-neutral-800 bg-[#070707] py-20 sm:py-28">
      <div className="lp-shell">
        {/* Section Header */}
        <motion.div
          className="mx-auto max-w-3xl text-center"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, ease: easeOut }}
        >
          <div className="inline-flex items-center gap-1.5 rounded-full border border-neutral-800 bg-neutral-900/90 px-3.5 py-1 text-xs font-mono font-medium text-neutral-300 mb-3 shadow-2xs">
            <Zap className="h-3.5 w-3.5 text-neutral-400" />
            TRANSPARENT DEPLOYMENT TIERS
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
            Predictable Security for Any Fleet Size
          </h2>
          <p className="mt-4 text-base text-neutral-400 sm:text-lg">
            Deploy in minutes with open-source client libraries or secure mission-critical agent swarms inside your own VPC.
          </p>

          {/* Billing Cycle Toggle */}
          <div className="mt-8 inline-flex items-center gap-1 rounded-xl border border-neutral-800 bg-neutral-900/90 p-1 font-mono text-xs shadow-md">
            <button
              type="button"
              onClick={() => setBillingCycle("annual")}
              className={`rounded-lg px-4 py-2 font-medium transition-all flex items-center gap-2 ${
                billingCycle === "annual"
                  ? "bg-white text-black font-semibold shadow-xs"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <span>Annual billing</span>
              <span className="rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold">
                Save 20%
              </span>
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle("monthly")}
              className={`rounded-lg px-4 py-2 font-medium transition-all ${
                billingCycle === "monthly"
                  ? "bg-white text-black font-semibold shadow-xs"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Monthly billing
            </button>
          </div>
        </motion.div>

        {/* Pricing Cards Grid */}
        <motion.div
          className="mt-14 grid gap-6 lg:grid-cols-3 items-stretch"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {PLANS.map((plan) => {
            const price = billingCycle === "annual" ? plan.annualPrice : plan.monthlyPrice;
            const periodNote =
              plan.name === "Team"
                ? billingCycle === "annual"
                  ? "per month · billed annually"
                  : "per month · billed monthly"
                : plan.periodNote;

            return (
              <motion.div
                key={plan.name}
                variants={fadeUp}
                transition={{ ease: easeOut }}
                className={`flex flex-col justify-between rounded-2xl p-7 sm:p-8 transition-all relative ${
                  plan.isPopular
                    ? "border-2 border-neutral-600 bg-[#121212] shadow-2xl ring-1 ring-neutral-700/80"
                    : "border border-neutral-800 bg-[#0e0e0e] shadow-md hover:border-neutral-700 hover:bg-[#111111]"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full border border-neutral-800 bg-neutral-900 px-2.5 py-0.5 text-[10px] font-mono font-semibold text-neutral-300">
                      {plan.badge}
                    </span>
                    {plan.isPopular ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white text-black font-mono text-[10px] font-bold px-2.5 py-0.5 uppercase tracking-wider shadow-xs">
                        <Sparkles className="h-3 w-3" />
                        Most Popular
                      </span>
                    ) : null}
                  </div>

                  <h3 className="mt-4 text-xl font-bold tracking-tight text-white">
                    {plan.name}
                  </h3>
                  <p className="mt-1.5 text-xs text-neutral-400 leading-relaxed font-sans min-h-[32px]">
                    {plan.description}
                  </p>

                  <div className="mt-5 flex items-baseline gap-2">
                    <span className="text-4xl font-extrabold tracking-tight text-white font-mono">
                      {price}
                    </span>
                    <span className="text-xs font-mono text-neutral-400">{periodNote}</span>
                  </div>

                  <div className="my-6 border-t border-neutral-800" />

                  <p className="font-mono text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3.5">
                    Included capabilities:
                  </p>

                  <ul className="space-y-3">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-xs sm:text-sm text-neutral-300">
                        <Check
                          className="mt-0.5 h-4 w-4 shrink-0 text-white stroke-[2.5]"
                          aria-hidden
                        />
                        <span className="leading-snug">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-8 pt-4">
                  {plan.isContact ? (
                    <LandingContactSalesButton
                      variant="ghost"
                      className="w-full rounded-xl border border-neutral-800 bg-neutral-900/90 py-3 px-4 text-xs font-mono font-semibold text-neutral-200 transition-all hover:bg-neutral-800 hover:border-neutral-700 hover:text-white shadow-xs"
                    >
                      {plan.cta}
                    </LandingContactSalesButton>
                  ) : (
                    <LandingSignInButton
                      variant="ghost"
                      className="w-full rounded-xl bg-white hover:bg-neutral-200 py-3 px-4 text-xs font-mono font-semibold text-black transition-colors shadow-md text-center block"
                      signInOptions={{ returnTo: "/command-center", mode: "register" }}
                    >
                      {plan.cta}
                    </LandingSignInButton>
                  )}
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Enterprise Trust Footnote */}
        <div className="mt-12 rounded-xl border border-neutral-850 bg-neutral-900/40 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-neutral-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>Guaranteed sub-10ms inline latency across all cloud and on-prem regions.</span>
          </div>
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-neutral-400 shrink-0" />
            <span>Digest-only forensic audit trail (Zero plaintext prompt storage).</span>
          </div>
        </div>
      </div>
    </section>
  );
}
