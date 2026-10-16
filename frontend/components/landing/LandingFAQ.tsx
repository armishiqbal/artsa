"use client";

import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { easeOut, staggerContainer, fadeUp } from "@/lib/motionPresets";

const FAQ = [
  {
    q: "Where can ARTSA apply runtime decisions?",
    a: "ARTSA supports enforcement at the LLM provider reverse proxy, native Python and TypeScript SDK decorators, and Model Context Protocol (MCP) stdio wrappers. Pre-execution checks inspect arguments before tool calls invoke real APIs or databases.",
  },
  {
    q: "What happens when an unauthorized request is quarantined?",
    a: "When a malicious or anomalous tool call is detected, ARTSA quarantines execution in sub-10ms, halts the process with a deterministic error, and records a cryptographically signed HMAC execution trace for SOC review.",
  },
  {
    q: "Can I test ARTSA in staging before deploying to production?",
    a: "Yes. Deploy ARTSA in observational mode (fail-open) in development or staging to audit tool calls, benchmark latency impact, and run automated adversarial red team scans without disrupting active pipelines.",
  },
  {
    q: "Do I need to refactor or replace my existing agent framework?",
    a: "No. ARTSA works seamlessly alongside LangChain, CrewAI, LlamaIndex, Anthropic Claude Code, and custom autonomous loops via single-line client wrappers or proxy routing.",
  },
  {
    q: "What evidence is retained for compliance and security investigations?",
    a: "ARTSA captures full session execution trees, tool parameters, model inputs/outputs, and policy evaluations with SHA-256 and HMAC digital signatures for non-repudiation audit defense.",
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
            Frequently Asked Questions
          </h2>
          <p className="mt-3 text-base text-slate-600">
            Clear technical answers on latency, deployment models, data privacy, and integration architecture.
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
