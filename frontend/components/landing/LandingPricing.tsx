"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { easeOut, staggerContainer, fadeUp } from "@/lib/motionPresets";
import { LandingSignInButton } from "./LandingSignInButton";
import { LandingContactSalesButton } from "./LandingContactSalesButton";

const PLANS = [
  {
    name: "Developer",
    price: "$0",
    note: "Free forever for individual engineers",
    features: [
      "Python & TypeScript SDK wrappers",
      "Model Context Protocol (MCP) guard",
      "Up to 25,000 monthly guarded tool calls",
      "Community Slack & GitHub support",
    ],
    cta: "Start free",
    highlight: false,
  },
  {
    name: "Team",
    price: "$499",
    note: "per month / billed annually",
    features: [
      "Multi-agent swarm execution graphs",
      "Automated adversarial red team campaigns",
      "500,000 monthly guarded tool calls",
      "HMAC-signed forensic execution replay",
      "Dedicated Slack bridge & SLA support",
    ],
    cta: "Deploy Team tier",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    note: "High-volume & regulated workloads",
    features: [
      "Self-hosted VPC & air-gapped deployment",
      "Custom threat heuristics & private LLM judges",
      "Unlimited agent fleets & tool calls",
      "Role-Based Access Control (RBAC) & SAML SSO",
      "24/7 incident response hotline",
    ],
    cta: "Talk to Enterprise Engineering",
    highlight: false,
    contact: true,
  },
] as const;

export function LandingPricing() {
  return (
    <section id="pricing" className="lp-section scroll-mt-24 border-t border-neutral-800 bg-[#070707] py-20 sm:py-28">
      <div className="lp-shell">
        <motion.div
          className="mx-auto max-w-3xl text-center"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, ease: easeOut }}
        >
          <div className="inline-flex items-center gap-1.5 rounded-full border border-neutral-800 bg-neutral-900/90 px-3.5 py-1 text-xs font-mono font-medium text-neutral-300 mb-3 shadow-2xs">
            DEPLOYMENT TIERS
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
            Predictable Security for Any Fleet Size
          </h2>
          <p className="mt-4 text-base text-neutral-400 sm:text-lg">
            Deploy in minutes with open-source client libraries or secure mission-critical agent swarms inside your own VPC.
          </p>
        </motion.div>

        <motion.div
          className="mt-14 grid gap-6 lg:grid-cols-3 items-stretch"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {PLANS.map((plan) => (
            <motion.div
              key={plan.name}
              variants={fadeUp}
              transition={{ ease: easeOut }}
              className={`flex flex-col justify-between rounded-2xl p-7 sm:p-8 transition-all ${
                plan.highlight
                  ? "border-2 border-neutral-600 bg-[#121212] shadow-xl relative ring-1 ring-neutral-700"
                  : "border border-neutral-800 bg-[#0e0e0e] shadow-md hover:border-neutral-700 hover:bg-[#111111]"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-bold tracking-tight text-white">
                    {plan.name}
                  </h3>
                  {plan.highlight ? (
                    <span className="rounded-full bg-white text-black font-mono text-[10px] font-bold px-2.5 py-0.5 uppercase tracking-wider shadow-2xs">
                      Most Popular
                    </span>
                  ) : null}
                </div>
                <div className="mt-5 flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold tracking-tight text-white">
                    {plan.price}
                  </span>
                  <span className="text-xs font-medium text-neutral-400 font-mono">{plan.note}</span>
                </div>
                <div className="my-6 border-t border-neutral-800" />
                <ul className="space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-neutral-300">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-white stroke-[2.5]"
                        aria-hidden
                      />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-8 pt-4">
                {"contact" in plan && plan.contact ? (
                  <LandingContactSalesButton
                    variant="ghost"
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-900/80 py-3 px-4 text-sm font-semibold text-neutral-200 transition-colors hover:bg-neutral-800 hover:text-white shadow-xs"
                  >
                    {plan.cta}
                  </LandingContactSalesButton>
                ) : (
                  <LandingSignInButton
                    variant="ghost"
                    className="w-full rounded-xl bg-white hover:bg-neutral-200 py-3 px-4 text-sm font-semibold text-black transition-colors shadow-md text-center block"
                    signInOptions={{ returnTo: "/command-center", mode: "register" }}
                  >
                    {plan.cta}
                  </LandingSignInButton>
                )}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
