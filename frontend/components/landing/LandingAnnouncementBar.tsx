"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { demoHref } from "@/lib/demoRoutes";

export function LandingAnnouncementBar() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="lp-announce relative z-[60]">
      <div className="lp-shell relative flex items-center justify-center text-center">
        <Link href={demoHref("guard")} className="pr-8 hover:underline">
          New — try the live containment demo. No signup required.
        </Link>
        <button
          type="button"
          aria-label="Dismiss announcement"
          className="absolute right-5 top-1/2 -translate-y-1/2 text-white/80 hover:text-white sm:right-8"
          onClick={() => setDismissed(true)}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
