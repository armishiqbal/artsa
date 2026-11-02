"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X, Calendar } from "lucide-react";
import Logo from "@/components/shared/Logo";
import { cn } from "@/lib/utils";
import { LandingSignInButton } from "./LandingSignInButton";
import { LandingContactSalesButton } from "./LandingContactSalesButton";

const NAV = [
  { href: "#platform", label: "Platform" },
  { href: "#integrations", label: "Quickstart" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
] as const;

export function LandingNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-all duration-200 bg-[#070707]/90 backdrop-blur-md border-b",
        scrolled ? "border-neutral-800 shadow-md" : "border-neutral-850 border-b-neutral-900"
      )}
    >
      <div className="lp-shell flex h-16 items-center justify-between gap-4">
        <Link href="/" className="shrink-0 flex items-center gap-2.5" aria-label="ARTSA home">
          <Logo iconSize={22} />
        </Link>

        <nav className="hidden items-center gap-6 xl:gap-8 lg:flex" aria-label="Primary">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-xs font-mono font-medium text-neutral-400 transition hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <LandingSignInButton
            variant="ghost"
            size="sm"
            className="font-mono text-xs text-neutral-400 hover:text-white hover:bg-neutral-900"
          >
            Sign in
          </LandingSignInButton>
          <LandingContactSalesButton
            variant="ghost"
            size="sm"
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/80 px-3.5 py-1.5 text-xs font-mono font-medium text-neutral-300 transition hover:bg-neutral-800 hover:text-white"
          >
            <Calendar className="h-3.5 w-3.5 text-neutral-400" />
            Book demo
          </LandingContactSalesButton>
          <Link
            href="/command-center"
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-1.5 text-xs font-mono font-semibold text-black shadow-xs transition hover:bg-neutral-200"
          >
            Explore Sandbox →
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-300 hover:bg-neutral-800 lg:hidden"
          aria-expanded={open}
          aria-controls="lp-mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5 text-white" /> : <Menu className="h-5 w-5 text-neutral-300" />}
        </button>
      </div>

      {open ? (
        <div
          id="lp-mobile-menu"
          className="border-t border-neutral-800 bg-[#0e0e0e] px-5 py-5 lg:hidden shadow-xl"
        >
          <nav className="flex flex-col gap-1.5 font-mono text-sm" aria-label="Mobile primary">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="py-2 text-neutral-300 transition hover:text-white"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-5 flex flex-col gap-2.5 border-t border-neutral-800 pt-4">
            <Link
              href="/command-center"
              className="w-full text-center rounded-lg bg-white py-2.5 text-xs font-mono font-semibold text-black shadow-xs hover:bg-neutral-200"
              onClick={() => setOpen(false)}
            >
              Explore Live Sandbox →
            </Link>
            <LandingContactSalesButton
              variant="ghost"
              className="w-full text-center rounded-lg border border-neutral-800 bg-neutral-900 py-2.5 text-xs font-mono font-medium text-neutral-200 shadow-2xs hover:bg-neutral-800 gap-1.5"
              onClick={() => setOpen(false)}
            >
              <Calendar className="h-3.5 w-3.5 text-neutral-400" />
              Schedule a demo
            </LandingContactSalesButton>
            <LandingSignInButton
              variant="ghost"
              className="w-full text-center py-2 text-xs font-mono text-neutral-400 hover:text-white"
              onClick={() => setOpen(false)}
            >
              Sign in to Portal
            </LandingSignInButton>
          </div>
        </div>
      ) : null}
    </header>
  );
}
