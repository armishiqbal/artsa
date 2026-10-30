"use client";

import Link from "next/link";
import Logo from "@/components/shared/Logo";
import { LandingSignInLink } from "./LandingSignInLink";
import { LandingContactSalesButton } from "./LandingContactSalesButton";

const COLS = [
  {
    title: "Platform",
    links: [
      { href: "#solution", label: "Threat Detection (ITDR)" },
      { href: "#solution", label: "Red Team Engine" },
      { href: "/command-center", label: "Command Center" },
      { href: "#solution", label: "Findings & Audit" },
      { href: "#swarm-defense", label: "Swarm Contagion Defense" },
    ],
  },
  {
    title: "Security & ASPM",
    links: [
      { href: "#swarm-defense", label: "Multi-Agent Swarm Defense" },
      { href: "#integrations", label: "Runtime Boundaries" },
      { href: "/risks", label: "OWASP ASI01-10 Matrix" },
      { href: "/guides/rag-astra", label: "RAG Pipeline Security" },
      { href: "#integrations", label: "Model Context Protocol (MCP)" },
    ],
  },
  {
    title: "Developers",
    links: [
      { href: "/get-started", label: "Documentation & SDKs" },
      { href: "#integrations", label: "Python & TypeScript Clients" },
      { href: "#pricing", label: "Pricing & Plans" },
      { href: "#faq", label: "Frequently Asked Questions" },
    ],
  },
  {
    title: "Enterprise",
    links: [
      { href: "#contact", label: "Schedule Architecture Demo" },
      { href: "/login", label: "Customer Portal" },
      { href: "/signup", label: "Create Developer Account" },
      { href: "#pricing", label: "Deployment Tiers" },
    ],
  },
] as const;

export function LandingFooter() {
  return (
    <footer className="border-t border-slate-200/80 bg-slate-50 py-16 text-slate-600">
      <div className="lp-shell">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <Logo iconSize={22} />
            <p className="mt-4 text-xs leading-relaxed text-slate-500 max-w-xs font-mono">
              The unified security platform for enterprise AI agents, multi-agent swarms, and MCP tools.
            </p>
            <LandingContactSalesButton
              variant="ghost"
              className="mt-5 inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 shadow-xs transition hover:bg-slate-50 hover:border-slate-400 font-mono"
            >
              Schedule a demo
            </LandingContactSalesButton>
          </div>
          {COLS.map((col) => (
            <div key={col.title}>
              <p className="font-mono text-xs font-bold uppercase tracking-wider text-slate-900">
                {col.title}
              </p>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-xs text-slate-600 transition hover:text-slate-950 font-mono"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 flex flex-col gap-3 border-t border-slate-200/80 pt-8 text-xs font-mono text-slate-500 sm:flex-row sm:justify-between items-center">
          <p>© {new Date().getFullYear()} ARTSA. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <span className="text-slate-500">Framework references: OWASP LLM/ASI, MITRE ATLAS, NIST AI RMF.</span>
            <LandingSignInLink className="text-slate-900 font-semibold hover:underline">
              Portal Sign In
            </LandingSignInLink>
          </div>
        </div>
      </div>
    </footer>
  );
}
