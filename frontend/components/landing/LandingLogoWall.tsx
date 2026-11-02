"use client";

import { motion } from "framer-motion";
import { Shield, Cpu } from "lucide-react";
import { easeOut, staggerContainer, fadeUp } from "@/lib/motionPresets";

const STACKS = [
  "LangChain",
  "CrewAI",
  "Model Context Protocol (MCP)",
  "OpenAI Swarms",
  "Anthropic Claude",
  "LlamaIndex",
  "Ollama",
] as const;

const STANDARDS = [
  { name: "OWASP Top 10 for LLMs", code: "ASI01 - ASI10" },
  { name: "MITRE ATLAS", code: "Adversarial Matrix" },
  { name: "NIST AI RMF", code: "Risk Framework" },
  { name: "EU AI Act", code: "Article 15 Ready" },
] as const;

export function LandingLogoWall() {
  return (
    <section className="border-y border-neutral-800 bg-[#0a0a0a] py-6" aria-label="Ecosystem and Standards">
      <div className="lp-shell space-y-4">
        {/* Row 1: Ecosystem compatibility */}
        <div className="flex flex-col items-center justify-between gap-3 md:flex-row">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-neutral-400 shrink-0 font-medium">
            <Cpu className="h-3.5 w-3.5 text-neutral-400" />
            <span>Works with your stack:</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-mono">
            {STACKS.map((st) => (
              <span
                key={st}
                className="rounded-md border border-neutral-800 bg-[#121212] px-2.5 py-1 text-neutral-300 shadow-2xs hover:border-neutral-700 transition-colors"
              >
                {st}
              </span>
            ))}
          </div>
        </div>

        {/* Row 2: Security Standards */}
        <div className="flex flex-col items-center justify-between gap-3 border-t border-neutral-800/80 pt-3.5 md:flex-row">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-neutral-400 shrink-0 font-medium">
            <Shield className="h-3.5 w-3.5 text-neutral-400" />
            <span>Standards alignment:</span>
          </div>

          <motion.div
            className="flex flex-wrap items-center justify-center gap-2"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {STANDARDS.map((s) => (
              <motion.div
                key={s.name}
                variants={fadeUp}
                transition={{ ease: easeOut }}
                className="inline-flex items-center gap-1.5 rounded-md border border-neutral-800 bg-[#121212] px-2.5 py-1 text-[11px] font-mono shadow-2xs hover:border-neutral-700 transition-colors"
              >
                <span className="font-semibold text-neutral-200">{s.name}</span>
                <span className="text-[10px] text-neutral-400">·</span>
                <span className="text-[10px] text-neutral-400">{s.code}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
