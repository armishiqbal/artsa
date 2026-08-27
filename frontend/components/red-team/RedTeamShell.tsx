"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useMemo } from "react";
import { isRedTeamHrefActive, redTeamNav, type LiveChromeState } from "@/lib/redTeamNav";
import { cn } from "@/lib/utils";

type SectionMeta = {
  title: string;
  subtitle: string;
};

function resolveSection(pathname: string): SectionMeta {
  if (pathname.startsWith("/red-team/campaigns")) {
    return {
      title: "Campaigns",
      subtitle: "Launch scans, open theaters, follow live runs — cohort is for action, not reporting.",
    };
  }
  if (pathname.startsWith("/red-team/lab")) {
    return {
      title: "Attack Lab",
      subtitle: "Probe containment now or launch a full Lab experiment against your target.",
    };
  }
  if (pathname === "/red-team/monitor/live" || pathname.startsWith("/red-team/monitor/live/")) {
    return {
      title: "Activity",
      subtitle: "Live AI work stream — probe, contain, and jump into theaters as events land.",
    };
  }
  if (pathname === "/red-team/monitor" || pathname === "/red-team/monitor/") {
    return {
      title: "Monitor",
      subtitle:
        "Watch live agent activity, risk trends, and campaign runs — then open what needs attention.",
    };
  }
  if (pathname.startsWith("/red-team/monitor/")) {
    return {
      title: "Monitor",
      subtitle: "Campaign theater — follow rounds and take the next containment action.",
    };
  }
  if (pathname.startsWith("/red-team/matrix")) {
    return {
      title: "Outcomes",
      subtitle: "Detection · prevention · leak by attack — open theater or retest in Lab.",
    };
  }
  if (pathname.startsWith("/red-team/graph")) {
    return {
      title: "Attack Graph",
      subtitle: "Kill-chain stages from the live campaign — open theater or retest a hot stage.",
    };
  }
  if (pathname.startsWith("/red-team/scoring")) {
    return {
      title: "Scoring",
      subtitle: "Judge verdicts from live runs — probe or launch to produce the next score.",
    };
  }

  let best: { name: string; href: string } | null = null;
  for (const group of redTeamNav) {
    for (const item of group.items) {
      if (!isRedTeamHrefActive(pathname, item.href, item.exact)) continue;
      if (!best || item.href.length > best.href.length) best = item;
    }
  }
  if (best) {
    const blurbs: Record<string, string> = {
      "Attack Lab": "Probe containment now or launch a full Lab experiment.",
      Campaigns: "Launch scans and open theaters — cohort for action.",
      Monitor: "Act on live risk — theaters, probe, launch.",
      Activity: "Live AI work — probe and jump into theaters.",
    };
    return {
      title: best.name,
      subtitle: blurbs[best.name] ?? "Red Team — probe, launch, contain.",
    };
  }
  return {
    title: "Red Team",
    subtitle: "Probe, launch campaigns, and contain — actions first.",
  };
}

function RedTeamShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const mode = searchParams.get("mode") === "research" ? "research" : "ops";
  const section = useMemo(() => resolveSection(pathname), [pathname]);

  const setMode = useCallback(
    (next: "ops" | "research") => {
      const q = new URLSearchParams(searchParams.toString());
      if (next === "research") q.set("mode", "research");
      else q.delete("mode");
      const qs = q.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  return (
    <div className="red-team-workspace -mx-1 min-h-[calc(100vh-7rem)]">
      <header className="mb-4 max-w-3xl pb-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Red Team
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground">
          {section.title}
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{section.subtitle}</p>
        <div className="mt-3 flex gap-4 text-[12px]">
          <button
            type="button"
            onClick={() => setMode("ops")}
            className={cn(
              "transition-colors",
              mode === "ops"
                ? "font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Ops
          </button>
          <button
            type="button"
            onClick={() => setMode("research")}
            className={cn(
              "transition-colors",
              mode === "research"
                ? "font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Research
          </button>
        </div>
      </header>

      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Dedicated Red Team chrome — header only; nav in main sidebar. */
export function RedTeamShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-[40vh] animate-pulse rounded-md bg-muted/20" />}>
      <RedTeamShellInner>{children}</RedTeamShellInner>
    </Suspense>
  );
}

/** Kept for theater pages; header no longer renders chrome badges. */
export function publishRedTeamChrome(state: LiveChromeState) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("artsa:redteam-chrome", { detail: { state } }));
}
