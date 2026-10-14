"use client";

import { motion } from "framer-motion";
import { easeOut, staggerContainer, fadeUp } from "@/lib/motionPresets";

const WORKFLOWS = [
  {
    capability: "Authentication",
    behavior: "Password sessions, API credentials, and OIDC credentials are accepted by protected API routes.",
    boundary: "Configure an authentication method and secret before enabling protected production access.",
  },
  {
    capability: "Campaign execution",
    behavior: "Backend campaign jobs run the configured agent pipeline and publish recorded progress and events.",
    boundary: "Provider connectivity and durable storage depend on the deployment configuration.",
  },
  {
    capability: "Session actions",
    behavior: "The backend records supported KILL and QUARANTINE actions against a session.",
    boundary: "Session state does not revoke a durable agent identity or prove an external tool was stopped.",
  },
  {
    capability: "Public walkthrough",
    behavior: "The unauthenticated demo uses illustrative sample records to show the interface.",
    boundary: "It is not live customer traffic or evidence from a connected deployment.",
  },
] as const;

export function LandingComparison() {
  return (
    <section id="compare" className="lp-section scroll-mt-24 border-t border-slate-200/80 bg-white py-20 sm:py-28">
      <div className="lp-shell">
        <motion.div
          className="mx-auto max-w-3xl text-center"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, ease: easeOut }}
        >
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3.5 py-1 font-mono text-xs font-medium text-blue-700 shadow-xs">
            WORKFLOW SCOPE
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
            What Each Workflow Actually Confirms
          </h2>
          <p className="mt-4 text-base text-slate-600 sm:text-lg">
            Authentication, backend records, and runtime enforcement are separate checks. Review the boundary before treating a status as proof of an external outcome.
          </p>
        </motion.div>

        <motion.div
          className="mt-12 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          transition={{ ease: easeOut }}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 font-mono text-xs uppercase tracking-wider text-slate-700">
                  <th className="px-5 py-4 font-semibold sm:px-6">Workflow</th>
                  <th className="px-5 py-4 font-semibold sm:px-6">Backend behavior</th>
                  <th className="px-5 py-4 font-semibold sm:px-6">Boundary</th>
                </tr>
              </thead>
              <motion.tbody variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                {WORKFLOWS.map((row) => (
                  <motion.tr
                    key={row.capability}
                    variants={fadeUp}
                    transition={{ ease: easeOut }}
                    className="border-b border-slate-100 transition-colors hover:bg-slate-50/60"
                  >
                    <td className="px-5 py-4 font-semibold text-slate-900 sm:px-6">{row.capability}</td>
                    <td className="px-5 py-4 leading-relaxed text-slate-700 sm:px-6">{row.behavior}</td>
                    <td className="px-5 py-4 leading-relaxed text-slate-600 sm:px-6">{row.boundary}</td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
