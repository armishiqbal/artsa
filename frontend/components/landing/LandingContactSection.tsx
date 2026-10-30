"use client";

import { motion } from "framer-motion";
import { Calendar, Shield, Award } from "lucide-react";
import { easeOut } from "@/lib/motionPresets";
import { ContactSalesForm } from "./LandingContactSales";
import { authLoginHref } from "@/lib/authSession";

const PERKS = [
  {
    icon: Calendar,
    title: "30-Minute Threat & Architecture Review",
    body: "Review your agent architecture and identify which integrations need separate validation.",
  },
  {
    icon: Shield,
    title: "Non-Invasive Deployment Fit",
    body: "Review supported provider, SDK, and MCP paths and the runtime changes each requires.",
  },
  {
    icon: Award,
    title: "Audit & Compliance Validation",
    body: "Review policy behavior, backend-supplied handoff verification status, and framework references in supported reports.",
  },
] as const;

export function LandingContactSection() {
  return (
    <section
      id="contact-sales"
      className="lp-section scroll-mt-24 border-t border-slate-200/80 bg-white py-20 sm:py-28"
    >
      <div id="contact" className="sr-only" />
      <div className="lp-shell">
        <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-16">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, ease: easeOut }}
          >
            <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1 text-xs font-mono font-medium text-slate-700 mb-3 shadow-2xs">
              <Calendar className="h-3.5 w-3.5" />
              SCHEDULE AN ARCHITECTURE REVIEW
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
              See the Control Points on Your Agent Fleet
            </h2>
            <p className="mt-4 text-base text-slate-600 leading-relaxed sm:text-lg font-sans">
              Tell us about the agent workflows you are shipping. Our security architects will walk
              through where ARTSA evaluates events, what the backend records, and which enforcement steps remain in your runtime.
            </p>
            <ul className="mt-10 space-y-6">
              {PERKS.map((p) => {
                const Icon = p.icon;
                return (
                  <li key={p.title} className="flex gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-800">
                      <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                    </div>
                    <div>
                      <p className="text-base font-semibold text-slate-900">
                        {p.title}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-600">{p.body}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </motion.div>

          <motion.div
            className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xl"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.08, duration: 0.5, ease: easeOut }}
          >
            <div className="mb-6 pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-xl">Book an Architecture Demo</h3>
              <p className="text-sm text-slate-500 mt-1">Connect with an enterprise security engineer.</p>
            </div>
            <ContactSalesForm
              idPrefix="section-contact"
              onLoginHref={authLoginHref({ returnTo: "/command-center" })}
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
