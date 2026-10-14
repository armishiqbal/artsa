"use client";

import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { easeOut, staggerContainer, fadeUp } from "@/lib/motionPresets";

const FAQ = [
  {
    q: "Where can ARTSA apply runtime decisions?",
    a: "ARTSA supports checks at provider proxy, SDK or agent wrapper, and MCP stdio boundaries. The exact point in the request depends on the integration: some checks happen before a response is returned, while wrapper checks inspect tool results after execution.",
  },
  {
    q: "What happens when a request is quarantined?",
    a: "On supported paths, ARTSA holds the result for operator approval instead of returning it immediately. The integration determines whether the check runs before or after a tool executes.",
  },
  {
    q: "Can I evaluate ARTSA without connecting a production agent?",
    a: "Yes. The interactive demo uses sample events and does not show live customer traffic. Use it to explore the Guard and Red Team workflows before configuring an integration.",
  },
  {
    q: "Do I need to replace my agent framework?",
    a: "No. ARTSA integrates at supported proxy, SDK or framework wrapper, and MCP stdio boundaries. Review the integration guide to choose the path that matches your stack.",
  },
  {
    q: "What evidence is retained for an investigation?",
    a: "Runtime forensic records retain digests and redacted findings for supported checks. Campaign results and session records provide additional context for investigation.",
  },
] as const;

export function LandingFAQ() {
  return (
    <section id="faq" className="lp-section scroll-mt-24 border-t border-slate-200/80 bg-slate-50/70 py-20 sm:py-28">
      <div className="lp-shell max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, ease: easeOut }}
          className="text-center"
        >
          <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3.5 py-1 text-xs font-mono font-medium text-blue-700 mb-3 shadow-xs">
            FREQUENTLY ASKED QUESTIONS
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
            Everything You Need to Know
          </h2>
          <p className="mt-3 text-base text-slate-600">
            Clear answers on latency, deployment models, data privacy, and integration architecture.
          </p>
        </motion.div>
        <motion.div
          className="mt-12 space-y-3"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {FAQ.map((item) => (
            <motion.details
              key={item.q}
              variants={fadeUp}
              transition={{ ease: easeOut }}
              className="group rounded-2xl border border-slate-200 bg-white shadow-xs transition-all open:border-blue-200 open:shadow-md"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 text-base font-semibold text-slate-900 marker:content-none hover:text-blue-600 select-none">
                {item.q}
                <ChevronDown
                  className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180 group-open:text-blue-600"
                  aria-hidden
                />
              </summary>
              <p className="border-t border-slate-100 px-6 pb-5 pt-4 text-sm leading-relaxed text-slate-600">
                {item.a}
              </p>
            </motion.details>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
