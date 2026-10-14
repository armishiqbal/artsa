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
      className="relative min-h-screen bg-white text-slate-900 selection:bg-blue-100 selection:text-blue-900"
      data-theme="light"
    >
      {/* Subtle grid on whole page */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage:
            "linear-gradient(#e2e8f0 1px, transparent 1px), linear-gradient(90deg, #e2e8f0 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          maskImage: "radial-gradient(ellipse 70% 60% at 30% 40%, black, transparent)",
        }}
        aria-hidden
      />

      <div className="relative z-10 grid min-h-screen lg:grid-cols-2">
        {/* Brand column */}
        <aside className="relative hidden flex-col border-r border-slate-200 bg-slate-50/70 p-10 lg:flex xl:p-14">
          <Link href="/" className="inline-flex w-fit" aria-label="ARTSA home">
            <Logo iconSize={22} />
          </Link>

          <div className="my-auto max-w-lg py-16">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-mono font-medium text-blue-700 shadow-xs mb-3">
              AGENT SECURITY PLATFORM
            </div>
            <h1 className="mt-3 text-[40px] font-bold leading-[1.15] tracking-tight text-slate-900 xl:text-[44px]">
              Secure every agent action before it lands.
            </h1>
            <div className="mt-10 space-y-5">
              {POINTS.map((p) => (
                <div key={p.title} className="flex items-start gap-3.5">
                  <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-600 font-bold text-xs" aria-hidden>
                    ✓
                  </span>
                  <div>
                    <p className="text-[15px] font-semibold tracking-tight text-slate-900">{p.title}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{p.body}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Mini product chrome */}
            <div className="mt-12 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
              <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5 bg-slate-50/70">
                <span className="h-2 w-2 rounded-full bg-slate-300" />
                <span className="h-2 w-2 rounded-full bg-slate-300" />
                <span className="h-2 w-2 rounded-full bg-slate-300" />
                <span className="ml-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  illustrative · not live telemetry
                </span>
              </div>
              <div className="space-y-2 p-4 font-mono text-xs">
                <p className="text-slate-600">example tool call · query_database</p>
                <div className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                  sample policy decision · QUARANTINE
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-400 font-mono">
            © {new Date().getFullYear()} ARTSA Security Inc.
          </p>
        </aside>

        {/* Form column */}
        <main className="flex flex-col bg-white px-5 py-8 sm:px-8 lg:px-12 xl:px-16 justify-between">
          <div className="mb-8 flex items-center justify-between lg:mb-0 lg:justify-end">
            <Link href="/" className="lg:hidden" aria-label="ARTSA home">
              <Logo iconSize={20} />
            </Link>
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 shadow-2xs">
              <Link
                href={signInHref}
                className={cn(
                  "rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all",
                  mode === "signin"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                Sign in
              </Link>
              <Link
                href={signUpHref}
                className={cn(
                  "rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all",
                  mode === "signup"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                Sign up
              </Link>
            </div>
          </div>

          <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center py-6 lg:py-10">
            <div className="rounded-3xl border border-slate-200 bg-white p-7 sm:p-9 shadow-xl">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                {title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {subtitle}
              </p>
              <div className="mt-7">{children}</div>
            </div>

            <p className="mt-6 text-center text-xs text-slate-500 font-medium">
              <Link href="/" className="hover:text-blue-600 hover:underline">
                ← Back to home
              </Link>
              <span className="mx-2 text-slate-300">·</span>
              <Link href="/#contact" className="hover:text-blue-600 hover:underline">
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
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs outline-none transition-colors focus:border-blue-600 focus:ring-1 focus:ring-blue-600";

export const authLabelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 font-mono";
