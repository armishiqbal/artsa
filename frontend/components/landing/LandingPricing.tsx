"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { easeOut, staggerContainer, fadeUp } from "@/lib/motionPresets";
import { demoHref } from "@/lib/demoRoutes";
import { LandingSignInButton } from "./LandingSignInButton";
import { LandingContactSalesButton } from "./LandingContactSalesButton";

const PLANS = [
  {
    name: "Sample walkthrough",
    price: "Open",
    note: "uses illustrative records",
    features: ["Explore the interface", "No live customer traffic", "No provider connection required"],
    cta: "Open sample",
    highlight: false,
  },
  {
    name: "Connected evaluation",
    price: "Configure",
    note: "requires backend access",
    features: ["Authenticate to a protected backend", "Configure a provider and storage", "Review tenant-scoped records"],
    cta: "Create account",
    highlight: false,
  },
  {
    name: "Deployment review",
    price: "Discuss",
    note: "scope specific",
    features: ["Authentication configuration", "Provider reachability", "Storage and runtime enforcement checks"],
    cta: "Request a review",
    highlight: false,
    contact: true,
  },
] as const;

export function LandingPricing() {
  return (
    <section id="pricing" className="lp-section scroll-mt-24 border-t border-slate-200/80 bg-white py-20 sm:py-28">
      <div className="lp-shell">
        <motion.div
          className="mx-auto max-w-3xl text-center"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, ease: easeOut }}
        >
          <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3.5 py-1 text-xs font-mono font-medium text-blue-700 mb-3 shadow-xs">
            DEPLOYMENT OPTIONS
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
            Start With the Evidence You Need
          </h2>
          <p className="mt-4 text-base text-slate-600 sm:text-lg">
            Pricing and deployment scope are not published here. The sample walkthrough is illustrative; a connected evaluation requires configured backend services.
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
                  ? "border-2 border-blue-600 bg-white shadow-xl ring-4 ring-blue-50 relative"
                  : "border border-slate-200 bg-white shadow-xs hover:border-slate-300 hover:shadow-md"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-bold tracking-tight text-slate-900">
                    {plan.name}
                  </h3>
                  {plan.highlight ? (
                    <span className="rounded-full bg-blue-600 text-white font-mono text-[10px] font-bold px-2.5 py-0.5 uppercase tracking-wider shadow-xs">
                      Popular
                    </span>
                  ) : null}
                </div>
                <div className="mt-5 flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold tracking-tight text-slate-900">
                    {plan.price}
                  </span>
                  <span className="text-xs font-medium text-slate-500 font-mono">{plan.note}</span>
                </div>
                <div className="my-6 border-t border-slate-100" />
                <ul className="space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-slate-600">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 stroke-[2.5]"
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
                    className="w-full rounded-xl border border-slate-300 bg-white py-3 px-4 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50 hover:border-slate-400 shadow-xs"
                  >
                    Contact sales
                  </LandingContactSalesButton>
                ) : plan.name === "Sample walkthrough" ? (
                  <Link
                    href={demoHref("guard")}
                    className="block w-full text-center rounded-xl border border-slate-300 bg-white py-3 px-4 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50 hover:border-slate-400 shadow-xs"
                  >
                    Open sample walkthrough
                  </Link>
                ) : (
                  <LandingSignInButton
                    variant="ghost"
                    className="w-full rounded-xl bg-blue-600 py-3 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700 shadow-md text-center block"
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
