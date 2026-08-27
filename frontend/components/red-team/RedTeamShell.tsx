"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { isRedTeamHrefActive, redTeamNav, type LiveChromeState } from "@/lib/redTeamNav";
import { useConnection } from "@/lib/context/ConnectionProvider";
import { cn } from "@/lib/utils";

function ChromeBadge({ state }: { state: LiveChromeState }) {
  if (state === "idle") return null;
  const map: Record<Exclude<LiveChromeState, "idle">, { label: string; className: string; pulse?: boolean }> = {
    connecting: {
      label: "Connecting",
      className: "border-[#6798ff]/40 bg-[#6798ff]/10 text-[#6798ff]",
      pulse: true,
    },
    live: {
      label: "LIVE",
      className: "border-[#6798ff]/50 bg-[#6798ff]/15 text-[#6798ff]",
      pulse: true,
    },
    paused: {
      label: "Paused",
      className:
        "border-[hsl(var(--severity-medium-border))] bg-[hsl(var(--severity-medium-subtle))] text-[hsl(var(--severity-medium))]",
    },
    stalled: {
      label: "Stalled",
      className:
        "border-[hsl(var(--severity-medium-border))] bg-[hsl(var(--severity-medium-subtle))] text-[hsl(var(--severity-medium))]",
    },
    ended: {
      label: "Ended",
      className:
        "border-[hsl(var(--severity-low-border))] bg-[hsl(var(--severity-low-subtle))] text-[hsl(var(--severity-low))]",
    },
    error: {
      label: "Error",
      className:
        "border-[hsl(var(--severity-critical-border))] bg-[hsl(var(--severity-critical-subtle))] text-[hsl(var(--severity-critical))]",
    },
  };
  const s = map[state];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        s.className
      )}
      role="status"
    >
      <span
        className={cn(
          "relative flex h-1.5 w-1.5",
          s.pulse && "before:absolute before:inset-0 before:animate-ping before:rounded-full before:bg-current before:opacity-40"
        )}
      >
        <span className="relative h-1.5 w-1.5 rounded-full bg-current" />
      </span>
      {s.label}
    </span>
  );
}

function RedTeamShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { apiOnline, wsConnected } = useConnection();

  const mode = searchParams.get("mode") === "research" ? "research" : "ops";
  const [alerts] = useState(0);

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

  const onMonitor = pathname.startsWith("/red-team/monitor/");
  const [chrome, setChrome] = useState<LiveChromeState>("idle");

  useEffect(() => {
    if (!onMonitor) {
      setChrome(apiOnline ? "idle" : "error");
      return;
    }
    if (!apiOnline) {
      setChrome("error");
      return;
    }
    setChrome("connecting");
    const t = window.setTimeout(() => setChrome("live"), 600);
    return () => window.clearTimeout(t);
  }, [onMonitor, apiOnline, pathname]);

  // Allow theater to publish chrome via custom event
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ state: LiveChromeState }>).detail;
      if (detail?.state) setChrome(detail.state);
    };
    window.addEventListener("artsa:redteam-chrome", handler);
    return () => window.removeEventListener("artsa:redteam-chrome", handler);
  }, []);

  return (
    <div className="red-team-workspace -mx-1 min-h-[calc(100vh-7rem)]">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-sm font-semibold tracking-tight text-foreground">ARTSA</h1>
          <span
            className="inline-flex items-center gap-1.5 rounded-sm border border-[hsl(var(--severity-critical-border))] bg-[hsl(var(--severity-critical-subtle))] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--severity-critical))]"
            aria-label="Red Team mode"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--severity-critical))]" aria-hidden />
            Red Team
          </span>
          <ChromeBadge state={chrome === "idle" && (apiOnline || wsConnected) ? "idle" : chrome} />
          {chrome === "idle" && apiOnline ? (
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {wsConnected ? "Feed ready" : "Polling"}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {alerts > 0 ? (
            <span className="rounded-sm border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
              {alerts}
            </span>
          ) : null}
          <div className="inline-flex rounded-md border border-border p-0.5" role="group" aria-label="Workspace mode">
            <button
              type="button"
              onClick={() => setMode("ops")}
              className={cn(
                "rounded-sm px-2.5 py-1 text-[11px]",
                mode === "ops" ? "bg-muted font-medium text-foreground" : "text-muted-foreground"
              )}
            >
              Ops
            </button>
            <button
              type="button"
              onClick={() => setMode("research")}
              className={cn(
                "rounded-sm px-2.5 py-1 text-[11px]",
                mode === "research" ? "bg-muted font-medium text-foreground" : "text-muted-foreground"
              )}
            >
              Research
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        <nav className="w-full shrink-0 lg:w-44" aria-label="Red Team navigation">
          <div className="space-y-5">
            {redTeamNav.map((group) => (
              <div key={group.label}>
                <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {group.label}
                </p>
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = isRedTeamHrefActive(pathname, item.href, item.exact);
                    const href =
                      mode === "research" && !item.href.includes("?")
                        ? `${item.href}?mode=research`
                        : mode === "research" && item.href.includes("?")
                          ? `${item.href}&mode=research`
                          : item.href;
                    return (
                      <li key={item.href}>
                        <Link
                          href={href}
                          className={cn(
                            "block rounded-md px-2 py-1.5 text-[13px] transition-colors",
                            active
                              ? "bg-muted/60 font-medium text-foreground"
                              : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                          )}
                          aria-current={active ? "page" : undefined}
                        >
                          {item.name}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

/** Dedicated Red Team chrome — forensic workspace (v2 Slice A). */
export function RedTeamShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-[40vh] animate-pulse rounded-md bg-muted/20" />}>
      <RedTeamShellInner>{children}</RedTeamShellInner>
    </Suspense>
  );
}

/** Theater pages publish connection chrome here. */
export function publishRedTeamChrome(state: LiveChromeState) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("artsa:redteam-chrome", { detail: { state } }));
}
