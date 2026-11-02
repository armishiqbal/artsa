"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, HelpCircle, ArrowRight } from "lucide-react";
import { easeOut } from "@/lib/motionPresets";
import { LandingContactSalesButton } from "./LandingContactSalesButton";

interface FAQItem {
  id: string;
  category: "all" | "runtime" | "compliance" | "architecture";
  q: string;
  a: string;
}

const FAQ_ITEMS: readonly FAQItem[] = [
  {
    id: "faq-runtime-boundaries",
    category: "runtime",
    q: "Where does ARTSA enforce runtime decisions?",
    a: "ARTSA enforces at three distinct boundaries: 1) At the LLM reverse proxy (non-streaming and streaming completions); 2) Via lightweight Python and TypeScript SDK decorators around tool definitions; and 3) Through `artsa-mcp-stdio`, a live stdio boundary wrapper that blocks malicious tool calls before reaching child Model Context Protocol servers.",
  },
  {
    id: "faq-latency-impact",
    category: "runtime",
    q: "What is the latency overhead on live agent operations?",
    a: "ARTSA is engineered for high-throughput environments with sub-10ms inline latency. Pre-execution checks evaluate schema compliance, tool permission boundaries, and parameter invariants deterministically before the target system executes them.",
  },
  {
    id: "faq-circuit-breaker",
    category: "runtime",
    q: "How does the ASI08 session circuit breaker protect against contagion?",
    a: "Under the OWASP ASI08 specification, three runtime `BLOCK` decisions within a rolling window trip a durable, tenant-isolated session breaker. The compromised agent session is immediately quarantined, preventing lateral contagion across multi-agent swarms.",
  },
  {
    id: "faq-data-privacy",
    category: "compliance",
    q: "Does ARTSA store raw prompts, database payloads, or proprietary code?",
    a: "No. ARTSA enforces a strict zero-plaintext retention policy. Audit records store cryptographic digests (`body_sha256` and `nonce_sha256`) along with HMAC non-repudiation signatures. Neither prompt bodies nor plaintext nonces are retained in central logs.",
  },
  {
    id: "faq-compliance-exports",
    category: "compliance",
    q: "What audit evidence is generated for SOC 2, ISO 42001, and NIST AI RMF?",
    a: "ARTSA generates cryptographic verification ledgers with Merkle roots, round-over-round adaptive lift metrics, and automated mappings against OWASP Top 10 for Agentic Applications (ASI01–ASI10) and MITRE ATLAS. Reports export to signed PDF and JSON.",
  },
  {
    id: "faq-framework-compatibility",
    category: "architecture",
    q: "Can I use ARTSA with LangChain, CrewAI, LlamaIndex, or custom agent loops?",
    a: "Yes. ARTSA is framework-agnostic. Whether your agents run via LangChain, CrewAI, LlamaIndex, Anthropic Claude Code, or proprietary orchestration loops, you can wrap tool calls in single-line decorators or route outbound LLM requests through the ARTSA security proxy.",
  },
  {
    id: "faq-vpc-airgap",
    category: "architecture",
    q: "Can ARTSA be self-hosted in a private VPC or air-gapped on-premise cloud?",
    a: "Yes. Enterprise customers can deploy ARTSA entirely within their own AWS, GCP, Azure VPC, or on-premise Kubernetes clusters. Credentials remain tenant-scoped and encrypted, with local Redis or in-memory replay caches.",
  },
  {
    id: "faq-staging-test",
    category: "architecture",
    q: "Can I run ARTSA in observational mode before enabling blocking?",
    a: "Yes. In staging or pilot phases, deploy ARTSA in fail-open or observational mode. The platform logs and scores all tool events without interrupting agent workflows, allowing teams to baseline false positive rates and calibrate policy thresholds safely.",
  },
] as const;

const CATEGORIES = [
  { id: "all", label: "All Questions" },
  { id: "runtime", label: "Runtime Protection" },
  { id: "compliance", label: "Evidence & Privacy" },
  { id: "architecture", label: "Architecture & VPC" },
] as const;

export function LandingFAQ() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [openIds, setOpenIds] = useState<Set<string>>(new Set([FAQ_ITEMS[0].id]));

  const toggleItem = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const filteredItems =
    selectedCategory === "all"
      ? FAQ_ITEMS
      : FAQ_ITEMS.filter((item) => item.category === selectedCategory);

  return (
    <section id="faq" className="lp-section scroll-mt-24 border-t border-neutral-800 bg-[#0a0a0a] py-20 sm:py-28">
      <div className="lp-shell max-w-4xl">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, ease: easeOut }}
          className="text-center"
        >
          <div className="inline-flex items-center gap-1.5 rounded-full border border-neutral-800 bg-neutral-900/90 px-3.5 py-1 text-xs font-mono font-medium text-neutral-300 mb-3 shadow-2xs">
            <HelpCircle className="h-3.5 w-3.5 text-neutral-400" />
            ENGINEERING FAQ
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
            Frequently Asked Questions
          </h2>
          <p className="mt-3 text-base text-neutral-400 font-sans max-w-2xl mx-auto">
            Clear technical answers on sub-10ms latency, zero-plaintext privacy, fail-closed enforcement, and VPC integration.
          </p>

          {/* Category Filter Pills */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`rounded-lg px-3.5 py-1.5 font-mono text-xs transition-all ${
                  selectedCategory === cat.id
                    ? "bg-white text-black font-semibold shadow-xs"
                    : "border border-neutral-800 bg-neutral-900/80 text-neutral-400 hover:text-white hover:bg-neutral-850"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Accordion List */}
        <div className="mt-12 space-y-3">
          {filteredItems.map((item) => {
            const isOpen = openIds.has(item.id);

            return (
              <div
                key={item.id}
                className={`rounded-2xl border transition-all ${
                  isOpen
                    ? "border-neutral-700 bg-[#121212] shadow-lg"
                    : "border-neutral-800 bg-[#0e0e0e] hover:border-neutral-750"
                }`}
              >
                <button
                  type="button"
                  id={`btn-${item.id}`}
                  aria-expanded={isOpen}
                  aria-controls={`panel-${item.id}`}
                  onClick={() => toggleItem(item.id)}
                  className="flex w-full cursor-pointer items-center justify-between gap-4 p-5 sm:p-6 text-left select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-400 rounded-2xl"
                >
                  <span className="text-base font-semibold text-white tracking-tight">
                    {item.q}
                  </span>
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 transition-transform duration-200 ${
                      isOpen ? "rotate-180 bg-neutral-800 text-white" : "text-neutral-400"
                    }`}
                  >
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen ? (
                    <motion.div
                      id={`panel-${item.id}`}
                      role="region"
                      aria-labelledby={`btn-${item.id}`}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-neutral-800/80 px-5 sm:px-6 pb-6 pt-4 text-sm leading-relaxed text-neutral-400 font-sans">
                        {item.a}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Contact CTA Card */}
        <div className="mt-12 rounded-2xl border border-neutral-800 bg-gradient-to-r from-neutral-900/60 via-[#0e0e0e] to-neutral-900/60 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h4 className="font-bold text-white text-base">Have custom architecture or compliance requirements?</h4>
            <p className="text-xs text-neutral-400 mt-1 font-sans">
              Our security architects will review your deployment topology in a 30-minute working session.
            </p>
          </div>
          <LandingContactSalesButton
            variant="ghost"
            className="shrink-0 h-10 px-4 rounded-xl border border-neutral-700 bg-white text-black font-mono text-xs font-semibold hover:bg-neutral-200 transition-colors inline-flex items-center gap-2"
          >
            <span>Talk to an Architect</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </LandingContactSalesButton>
        </div>
      </div>
    </section>
  );
}
