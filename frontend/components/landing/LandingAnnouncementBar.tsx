"use client";

import { useState } from "react";
import Link from "next/link";
import { X, ArrowRight } from "lucide-react";

export function LandingAnnouncementBar() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="relative z-[60] border-b border-neutral-800 bg-[#0c0c0c] py-2 text-xs font-mono text-neutral-300">
      <div className="lp-shell relative flex items-center justify-center text-center">
        <Link
          href="#integrations"
          className="inline-flex items-center gap-2 font-medium transition hover:text-white pr-8"
        >
          <span className="rounded-full border border-neutral-700 bg-neutral-900 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-200 shadow-2xs">
            REPORT
          </span>
          <span className="hidden sm:inline text-neutral-300">
            40% of deployed agents operate with unreviewed tool permissions. Read the 2026 Agent Security Playbook.
          </span>
          <span className="underline underline-offset-4 flex items-center gap-1 text-white font-semibold">
            Read playbook <ArrowRight className="h-3 w-3" />
          </span>
        </Link>
        <button
          type="button"
          aria-label="Dismiss announcement"
          className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-200 transition-colors"
          onClick={() => setDismissed(true)}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
