"use client";

import { useState } from "react";
import Link from "next/link";
import { X, ArrowRight } from "lucide-react";

export function LandingAnnouncementBar() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="relative z-[60] border-b border-blue-200/60 bg-gradient-to-r from-blue-50 via-indigo-50/70 to-blue-50 py-2.5 text-xs font-mono text-slate-700">
      <div className="lp-shell relative flex items-center justify-center text-center">
        <Link
          href="#integrations"
          className="inline-flex items-center gap-2 font-medium transition hover:text-blue-700 pr-8"
        >
          <span className="rounded-full bg-blue-600 text-white px-2.5 py-0.5 text-[10px] uppercase font-bold tracking-wider shadow-sm">
            REPORT
          </span>
          <span className="hidden sm:inline">
            40% of deployed agents operate with unreviewed tool permissions. Read the 2026 Agent Security Playbook.
          </span>
          <span className="underline underline-offset-4 flex items-center gap-1 text-blue-700 font-semibold">
            Read playbook <ArrowRight className="h-3 w-3" />
          </span>
        </Link>
        <button
          type="button"
          aria-label="Dismiss announcement"
          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
          onClick={() => setDismissed(true)}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
