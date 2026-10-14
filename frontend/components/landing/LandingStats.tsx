"use client";

import { motion } from "framer-motion";
import { easeOut, staggerContainer, fadeUp } from "@/lib/motionPresets";

const WORKFLOWS = [
  { label: "Authentication", value: "Protected API", detail: "Password sessions, API credentials, and tenant-scoped access." },
  { label: "Campaigns", value: "Backend execution", detail: "Campaign jobs run through the configured agent pipeline." },
  { label: "Evidence", value: "Stored records", detail: "Findings and replay views use records returned by the backend." },
  { label: "Response", value: "Confirmed actions", detail: "The interface reports containment only after backend confirmation." },
] as const;

export function LandingStats() {
  return (
    <section className="px-4 py-8 sm:px-6 bg-white border-b border-slate-100">
      <div className="lp-shell">
        <motion.div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
        >
          {WORKFLOWS.map((stat) => (
            <motion.div key={stat.label} variants={fadeUp} transition={{ ease: easeOut }}>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs transition hover:shadow-md hover:border-slate-300">
                <p className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-500">
                  {stat.label}
                </p>
                <p className="mt-2 font-mono text-3xl sm:text-4xl font-extrabold tabular-nums text-slate-900">
                  {stat.value}
                </p>
                <p className="mt-1.5 text-xs text-slate-600 font-medium">{stat.detail}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
