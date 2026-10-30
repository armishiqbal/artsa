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
        "sticky top-0 z-50 transition-all duration-200 bg-white/90 backdrop-blur-md border-b",
        scrolled ? "border-slate-200 shadow-sm" : "border-slate-100"
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
              className="text-xs font-mono font-medium text-slate-600 transition hover:text-slate-950"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Link
            href="/command-center"
            className="font-mono text-xs text-slate-600 hover:text-slate-900 transition-colors"
          >
            Live Demo
          </Link>
          <LandingSignInButton variant="ghost" size="sm" className="font-mono text-xs text-slate-600 hover:text-slate-900">
            Sign in
          </LandingSignInButton>
          <LandingSignInButton
            variant="ghost"
            size="sm"
            className="inline-flex items-center gap-1.5 rounded-full bg-black px-4 py-2 text-xs font-mono font-semibold text-white shadow-sm transition hover:bg-slate-900"
            signInOptions={{ returnTo: "/command-center", mode: "register" }}
          >
            Get started free
          </LandingSignInButton>
          <LandingContactSalesButton
            variant="ghost"
            size="sm"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3.5 py-2 text-xs font-mono font-semibold text-slate-800 shadow-xs transition hover:bg-slate-50 hover:border-slate-400"
          >
            <Calendar className="h-3.5 w-3.5" />
            Book demo
          </LandingContactSalesButton>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 lg:hidden"
          aria-expanded={open}
          aria-controls="lp-mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5 text-slate-700" />}
        </button>
      </div>

      {open ? (
        <div
          id="lp-mobile-menu"
          className="border-t border-slate-200 bg-white px-5 py-5 lg:hidden shadow-lg"
        >
          <nav className="flex flex-col gap-1.5 font-mono text-sm" aria-label="Mobile primary">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="py-2 text-slate-700 transition hover:text-black hover:font-semibold"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-5 flex flex-col gap-2.5 border-t border-slate-100 pt-4">
            <Link
              href="/command-center"
              className="w-full text-center rounded-full border border-slate-200 bg-slate-50 py-2.5 text-xs font-mono font-semibold text-slate-800 shadow-xs hover:bg-slate-100"
              onClick={() => setOpen(false)}
            >
              Explore Live Demo
            </Link>
            <LandingSignInButton
              variant="ghost"
              className="w-full text-center rounded-full bg-black py-2.5 text-xs font-mono font-semibold text-white shadow-sm hover:bg-slate-900"
              signInOptions={{ returnTo: "/command-center", mode: "register" }}
            >
              Get started free
            </LandingSignInButton>
            <LandingContactSalesButton
              variant="ghost"
              className="w-full text-center rounded-full border border-slate-300 bg-white py-2.5 text-xs font-mono font-semibold text-slate-800 shadow-sm hover:bg-slate-50 gap-1.5"
            >
              <Calendar className="h-3.5 w-3.5" />
              Schedule a demo
            </LandingContactSalesButton>
          </div>
        </div>
      ) : null}
    </header>
  );
}
