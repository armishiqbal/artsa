"use client";

import { useState } from "react";
import Link from "next/link";
import { X, ArrowRight, ShieldCheck } from "lucide-react";

export function LandingAnnouncementBar() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <aside
      aria-label="Security Announcement"
      className="relative z-[60] border-b border-white/[0.08] bg-[#0a0a0a] py-2 text-xs font-mono text-neutral-300"
    >
      <div className="lp-shell relative flex items-center justify-center text-center">
        <Link
          href="/risks"
          className="group inline-flex items-center gap-2 font-medium transition hover:text-white pr-8 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-400 rounded-md px-1"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-700/80 bg-neutral-900/90 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-200 shadow-2xs">
            <ShieldCheck className="h-3 w-3 text-emerald-400" aria-hidden />
            REPORT
          </span>
          <span className="hidden sm:inline text-neutral-400 group-hover:text-neutral-200 transition-colors">
            40% of deployed agents execute with excessive permissions. Read the 2026 Agent Security Matrix.
          </span>
          <span className="inline-flex items-center gap-1 text-white font-semibold underline underline-offset-4 decoration-neutral-600 group-hover:decoration-white transition-colors">
            Explore Matrix
            <ArrowRight className="h-3 w-3 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
          </span>
        </Link>
        <button
          type="button"
          aria-label="Dismiss announcement"
          className="absolute right-4 top-1/2 -translate-y-1/2 rounded-md p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-400"
          onClick={() => setDismissed(true)}
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </aside>
  );
}
