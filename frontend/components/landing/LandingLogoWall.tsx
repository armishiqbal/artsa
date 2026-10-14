"use client";

import { motion } from "framer-motion";
import { Shield, BookOpen } from "lucide-react";
import { easeOut, staggerContainer, fadeUp } from "@/lib/motionPresets";

const FRAMEWORKS = [
  { name: "OWASP LLM / ASI", code: "Risk references" },
  { name: "MITRE ATLAS", code: "Threat Matrix" },
  { name: "NIST AI RMF", code: "Framework reference" },
  { name: "EU AI Act", code: "Article 15 reference" },
] as const;

export function LandingLogoWall() {
  return (
    <section className="border-y border-slate-200 bg-slate-50/70 py-8" aria-label="Security Framework Alignment">
      <div className="lp-shell">
        <div className="flex flex-col items-center justify-between gap-6 lg:flex-row">
          <div className="flex items-center gap-2.5 text-xs font-mono uppercase tracking-wider text-slate-600 shrink-0 font-medium">
            <Shield className="h-4 w-4 text-blue-600" />
            <span>Framework references in selected reports:</span>
          </div>

          <motion.div
            className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {FRAMEWORKS.map((fw) => (
              <motion.div
                key={fw.name}
                variants={fadeUp}
                transition={{ ease: easeOut }}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-mono shadow-xs transition-all hover:border-blue-400 hover:bg-blue-50/30"
              >
                <BookOpen className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                <span className="font-semibold text-slate-900">{fw.name}</span>
                <span className="text-[10px] text-slate-500 border-l border-slate-200 pl-2">{fw.code}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
