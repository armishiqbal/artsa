"use client";

import Link from "next/link";
import Logo from "@/components/shared/Logo";
import { authLoginHref, authSignupHref } from "@/lib/authSession";
import { cn } from "@/lib/utils";

const POINTS = [
  { title: "Contain at runtime", body: "Evaluate each tool call before execution." },
  { title: "Prove control", body: "Findings, custody trails, and readiness exports for auditors." },
  { title: "Test like attackers", body: "Red-team campaigns with coverage grids and judge verdicts." },
] as const;

export function AuthShell({
  children,
  mode,
  title,
  subtitle,
  returnTo,
}: {
  children: React.ReactNode;
  mode: "signin" | "signup";
  title: string;
  subtitle: string;
  returnTo?: string;
}) {
  const signInHref = authLoginHref({ returnTo });
  const signUpHref = authSignupHref({ returnTo });

  return (
    <div
      className="relative min-h-screen bg-[#070707] text-white selection:bg-neutral-800 selection:text-white"
      data-theme="dark"
    >
      {/* Subtle grid on whole page */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255, 255, 255, 0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.4) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          maskImage: "radial-gradient(ellipse 70% 60% at 30% 40%, black, transparent)",
        }}
        aria-hidden
      />

      <div className="relative z-10 grid min-h-screen lg:grid-cols-2">
        {/* Brand column */}
        <aside className="relative hidden flex-col border-r border-neutral-800 bg-[#0c0c0c] p-10 lg:flex xl:p-14">
          <Link href="/" className="inline-flex w-fit" aria-label="ARTSA home">
            <Logo iconSize={22} />
          </Link>

          <div className="my-auto max-w-lg py-16">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-neutral-800 bg-neutral-900/90 px-3 py-1 text-xs font-mono font-medium text-neutral-300 shadow-2xs mb-3">
              AGENT SECURITY PLATFORM
            </div>
            <h1 className="mt-3 text-[40px] font-bold leading-[1.15] tracking-tight text-white xl:text-[44px]">
              Secure every agent action before it lands.
            </h1>
            <div className="mt-10 space-y-5">
              {POINTS.map((p) => (
                <div key={p.title} className="flex items-start gap-3.5">
                  <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 text-emerald-400 font-bold text-xs" aria-hidden>
                    ✓
                  </span>
                  <div>
                    <p className="text-[15px] font-semibold tracking-tight text-white">{p.title}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-neutral-400">{p.body}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Mini product chrome */}
            <div className="mt-12 overflow-hidden rounded-2xl border border-neutral-800 bg-[#0e0e0e] shadow-md">
              <div className="flex items-center gap-2 border-b border-neutral-800 px-4 py-2.5 bg-[#141414]">
                <span className="h-2 w-2 rounded-full bg-neutral-700" />
                <span className="h-2 w-2 rounded-full bg-neutral-700" />
                <span className="h-2 w-2 rounded-full bg-neutral-700" />
                <span className="ml-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                  illustrative · not live telemetry
                </span>
              </div>
              <div className="space-y-2 p-4 font-mono text-xs">
                <p className="text-neutral-400">example tool call · query_database</p>
                <div className="inline-flex items-center gap-2 rounded-md border border-rose-900/60 bg-rose-950/40 px-2.5 py-1 text-xs font-semibold text-rose-400">
                  sample policy decision · QUARANTINE
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-neutral-500 font-mono">
            © {new Date().getFullYear()} ARTSA Security Inc.
          </p>
        </aside>

        {/* Form column */}
        <main className="flex flex-col bg-[#070707] px-5 py-8 sm:px-8 lg:px-12 xl:px-16 justify-between">
          <div className="mb-8 flex items-center justify-between lg:mb-0 lg:justify-end">
            <Link href="/" className="lg:hidden" aria-label="ARTSA home">
              <Logo iconSize={20} />
            </Link>
            <div className="flex items-center gap-1 rounded-xl border border-neutral-800 bg-neutral-900 p-1 shadow-2xs">
              <Link
                href={signInHref}
                className={cn(
                  "rounded-lg px-3.5 py-1.5 text-xs font-semibold font-mono transition-all",
                  mode === "signin"
                    ? "bg-white text-black shadow-xs"
                    : "text-neutral-400 hover:text-white"
                )}
              >
                Sign in
              </Link>
              <Link
                href={signUpHref}
                className={cn(
                  "rounded-lg px-3.5 py-1.5 text-xs font-semibold font-mono transition-all",
                  mode === "signup"
                    ? "bg-white text-black shadow-xs"
                    : "text-neutral-400 hover:text-white"
                )}
              >
                Sign up
              </Link>
            </div>
          </div>

          <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center py-6 lg:py-10">
            <div className="rounded-3xl border border-neutral-800 bg-[#0e0e0e] p-7 sm:p-9 shadow-2xl">
              <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                {subtitle}
              </p>
              <div className="mt-7">{children}</div>
            </div>

            <p className="mt-6 text-center text-xs text-neutral-400 font-medium">
              <Link href="/" className="hover:text-white hover:underline">
                ← Back to home
              </Link>
              <span className="mx-2 text-neutral-600">·</span>
              <Link href="/#contact" className="hover:text-white hover:underline">
                Contact sales
              </Link>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}

export const authFieldClass =
  "w-full rounded-xl border border-neutral-800 bg-[#141414] px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-500 shadow-2xs outline-none transition-colors focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500";

export const authLabelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-300 font-mono";
