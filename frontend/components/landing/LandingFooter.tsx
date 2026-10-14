"use client";

import Link from "next/link";
import Logo from "@/components/shared/Logo";
import { demoHref } from "@/lib/demoRoutes";
import { LandingSignInLink } from "./LandingSignInLink";
import { LandingContactSalesButton } from "./LandingContactSalesButton";

const COLS = [
  {
    title: "Platform",
    links: [
      { href: demoHref("guard"), label: "Threat Detection (ITDR)" },
      { href: demoHref("redteam"), label: "Red Team Engine" },
      { href: demoHref("command"), label: "Command Center" },
      { href: demoHref("findings"), label: "Findings & Audit" },
      { href: demoHref("replay"), label: "Session Autopsy" },
    ],
  },
  {
    title: "Security & ASPM",
    links: [
      { href: "/#simulator", label: "Interactive Console" },
      { href: "/#swarm-defense", label: "Swarm Contagion Defense" },
      { href: "/#integrations", label: "Runtime Boundaries" },
      { href: "/risks", label: "OWASP ASI01-10 Matrix" },
      { href: "/guides/rag-astra", label: "RAG Pipeline Security" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "/get-started", label: "Documentation & SDK" },
      { href: "/demo", label: "Sample Walkthrough" },
      { href: "/#compare", label: "Why ARTSA (Comparison)" },
      { href: "/#faq", label: "Frequently Asked Questions" },
    ],
  },
  {
    title: "Enterprise",
    links: [
      { href: "/#contact", label: "Schedule Demo" },
      { href: "/login", label: "Customer Portal" },
      { href: "/signup", label: "Create Account" },
      { href: "/#pricing", label: "Pricing & Plans" },
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
              The unified security platform for enterprise AI agents, SaaS integrations, and autonomous swarms.
            </p>
            <LandingContactSalesButton
              variant="ghost"
              className="mt-5 inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 shadow-xs transition hover:bg-slate-50 hover:border-slate-400 font-mono"
            >
              Schedule a demo
            </LandingContactSalesButton>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-amber-200/70 bg-amber-50 px-2.5 py-1 text-[11px] font-mono text-amber-900">
              <span>Public walkthrough uses illustrative sample records.</span>
            </div>
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
                      className="text-xs text-slate-600 transition hover:text-blue-600 font-mono"
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
          <p>© {new Date().getFullYear()} ARTSA.</p>
          <div className="flex items-center gap-6">
            <span className="text-slate-500">Framework references do not imply certification.</span>
            <LandingSignInLink className="text-blue-600 font-semibold hover:underline">
              Portal Sign In
            </LandingSignInLink>
          </div>
        </div>
      </div>
    </footer>
  );
}
