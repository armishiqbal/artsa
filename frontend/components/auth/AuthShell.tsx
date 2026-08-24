"use client";

import Link from "next/link";
import Logo from "@/components/shared/Logo";
import { authLoginHref, authSignupHref } from "@/lib/authSession";
import { cn } from "@/lib/utils";

const POINTS = [
  { title: "Contain at runtime", body: "Score every tool call under 50ms before it executes." },
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
    <div className="relative min-h-screen bg-[#0a0a0a] text-white">
      {/* Subtle grid on whole page */}
      <div
        className="pointer-events-none absolute inset-0 opacity-100"
        style={{
          backgroundImage:
            "linear-gradient(#1e1e1e 1px, transparent 1px), linear-gradient(90deg, #1e1e1e 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse 70% 60% at 30% 40%, black, transparent)",
        }}
        aria-hidden
      />

      <div className="relative z-10 grid min-h-screen lg:grid-cols-2">
        {/* Brand column */}
        <aside className="relative hidden flex-col border-r border-[#313131] bg-[#0a0a0a]/90 p-10 lg:flex xl:p-14">
          <Link href="/" className="inline-flex w-fit" aria-label="ARTSA home">
            <Logo iconSize={22} />
          </Link>

          <div className="my-auto max-w-lg py-16">
            <p className="font-mono text-[12px] uppercase tracking-[0.85px] text-[#6798ff]">
              Agent security platform
            </p>
            <h1 className="mt-5 text-[44px] font-semibold leading-[1.12] tracking-[-1.2px] text-white">
              Secure every agent action before it lands.
            </h1>
            <div className="mt-12 space-y-6">
              {POINTS.map((p) => (
                <div key={p.title} className="flex gap-4">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#6798ff]" aria-hidden />
                  <div>
                    <p className="text-[15px] font-medium tracking-[-0.19px] text-white">{p.title}</p>
                    <p className="mt-1 text-[14px] leading-relaxed text-[#a7a7a7]">{p.body}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Mini product chrome */}
            <div
              className="mt-14 overflow-hidden rounded-[8px] border border-[#313131]"
              style={{ backgroundColor: "#1e1e1e" }}
            >
              <div className="flex items-center gap-2 border-b border-[#313131] px-4 py-2.5">
                <span className="h-2 w-2 rounded-full bg-[#454545]" />
                <span className="h-2 w-2 rounded-full bg-[#454545]" />
                <span className="h-2 w-2 rounded-full bg-[#454545]" />
                <span className="ml-2 font-mono text-[11px] tracking-[0.85px] text-[#7c7c7c]">
                  runtime guard · live
                </span>
              </div>
              <div className="space-y-2 p-4 font-mono text-[11px]">
                <p className="text-[#7c7c7c]">tool_call · query_database</p>
                <p className="text-[#6798ff]">QUARANTINE · 4.2ms · risk 94</p>
              </div>
            </div>
          </div>

          <p className="text-[12px] text-[#7c7c7c]">
            © {new Date().getFullYear()} ARTSA
          </p>
        </aside>

        {/* Form column */}
        <main className="flex flex-col bg-[#141414] px-5 py-8 sm:px-8 lg:bg-[#0a0a0a] lg:px-12 xl:px-16">
          <div className="mb-8 flex items-center justify-between lg:mb-0 lg:justify-end">
            <Link href="/" className="lg:hidden" aria-label="ARTSA home">
              <Logo iconSize={20} />
            </Link>
            <div className="flex items-center gap-1 rounded-[8px] border border-[#313131] bg-[#1e1e1e] p-1">
              <Link
                href={signInHref}
                className={cn(
                  "rounded-[6px] px-3.5 py-1.5 text-[13px] font-medium tracking-[-0.17px] transition-colors",
                  mode === "signin"
                    ? "bg-white text-[#0a0a0a]"
                    : "text-[#a7a7a7] hover:text-white"
                )}
              >
                Sign in
              </Link>
              <Link
                href={signUpHref}
                className={cn(
                  "rounded-[6px] px-3.5 py-1.5 text-[13px] font-medium tracking-[-0.17px] transition-colors",
                  mode === "signup"
                    ? "bg-white text-[#0a0a0a]"
                    : "text-[#a7a7a7] hover:text-white"
                )}
              >
                Sign up
              </Link>
            </div>
          </div>

          <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center py-6 lg:py-10">
            <div
              className="rounded-[8px] border border-[#313131] p-6 sm:p-8"
              style={{ backgroundColor: "#1e1e1e" }}
            >
              <h2 className="text-[28px] font-semibold leading-[1.2] tracking-[-0.6px] text-white sm:text-[32px]">
                {title}
              </h2>
              <p className="mt-2 text-[14px] leading-relaxed tracking-[-0.17px] text-[#a7a7a7]">
                {subtitle}
              </p>
              <div className="mt-7">{children}</div>
            </div>

            <p className="mt-6 text-center text-[13px] text-[#7c7c7c]">
              <Link href="/" className="hover:text-[#a7a7a7]">
                ← Back to home
              </Link>
              <span className="mx-2 text-[#454545]">·</span>
              <Link href="/#contact" className="hover:text-[#a7a7a7]">
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
  "w-full rounded-[8px] border border-[#313131] bg-[#0a0a0a] px-3 py-2.5 text-[14px] tracking-[-0.17px] text-white placeholder:text-[#7c7c7c] outline-none transition-colors focus:border-[#6798ff]";

export const authLabelClass =
  "mb-1.5 block text-[13px] font-medium tracking-[-0.17px] text-[#a7a7a7]";
