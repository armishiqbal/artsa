"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X, Calendar, ArrowRight, Shield, BookOpen, Layers, Terminal, Sparkles } from "lucide-react";
import Logo from "@/components/shared/Logo";
import { cn } from "@/lib/utils";
import { LandingSignInButton } from "./LandingSignInButton";
import { LandingContactSalesButton } from "./LandingContactSalesButton";

interface NavItem {
  href: string;
  label: string;
  isExternal?: boolean;
  badge?: string;
}

const NAV_ITEMS: readonly NavItem[] = [
  { href: "#platform", label: "Platform" },
  { href: "/risks", label: "Matrix", badge: "ASI01-10", isExternal: true },
  { href: "#integrations", label: "Quickstart" },
  { href: "#pricing", label: "Pricing" },
  { href: "/get-started", label: "Docs", isExternal: true },
] as const;

export function LandingNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Track active section via IntersectionObserver
  useEffect(() => {
    const sectionIds = ["platform", "integrations", "pricing", "faq"];
    const observers: IntersectionObserver[] = [];

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setActiveSection(id);
            }
          });
        },
        { rootMargin: "-25% 0px -65% 0px" }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => {
      observers.forEach((obs) => obs.disconnect());
    };
  }, []);

  // Close mobile drawer on Escape key
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleNavClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
      if (href.startsWith("#")) {
        e.preventDefault();
        const targetId = href.slice(1);
        const element = document.getElementById(targetId);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
          window.history.pushState(null, "", href);
          setActiveSection(targetId);
        }
      }
      setOpen(false);
    },
    []
  );

  return (
    <>
      {/* Accessible skip link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:font-mono focus:text-xs focus:font-semibold focus:text-black focus:shadow-xl focus:ring-2 focus:ring-neutral-400"
      >
        Skip to main content
      </a>

      <header
        className={cn(
          "sticky top-0 z-50 transition-all duration-300 backdrop-blur-md",
          scrolled
            ? "border-b border-neutral-800/90 bg-[#070707]/95 shadow-xl shadow-black/50"
            : "border-b border-white/[0.06] bg-[#070707]/85"
        )}
      >
        <div className="lp-shell flex h-16 items-center justify-between gap-4">
          {/* Left Brand & Status HUD */}
          <div className="flex items-center gap-4 shrink-0">
            <Link
              href="/"
              className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-400"
              aria-label="ARTSA home"
            >
              <Logo iconSize={22} />
            </Link>

            <div className="hidden xl:flex items-center gap-2 pl-3.5 border-l border-neutral-800">
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-mono text-[11px] text-neutral-400 tracking-tight">Active Defense · v1.4</span>
            </div>
          </div>

          {/* Center Navigation Links */}
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
            {NAV_ITEMS.map((item) => {
              const isAnchorActive = item.href === `#${activeSection}`;
              const isPageActive = item.isExternal && pathname === item.href;
              const isActive = isAnchorActive || isPageActive;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={(e) => handleNavClick(e, item.href)}
                  className={cn(
                    "relative px-3 py-1.5 rounded-lg font-mono text-xs font-medium transition-all duration-150 inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-400",
                    isActive
                      ? "text-white bg-white/[0.08] shadow-2xs font-semibold"
                      : "text-neutral-400 hover:text-white hover:bg-neutral-900/60"
                  )}
                >
                  {item.label}
                  {item.badge ? (
                    <span className="rounded border border-neutral-700/80 bg-neutral-850 px-1 py-0.2 text-[9px] font-mono font-medium text-neutral-300">
                      {item.badge}
                    </span>
                  ) : null}
                  {isActive ? (
                    <span className="absolute bottom-0.5 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full bg-white/70" />
                  ) : null}
                </Link>
              );
            })}
          </nav>

          {/* Right Action CTAs */}
          <div className="hidden items-center gap-2.5 lg:flex">
            <LandingSignInButton
              variant="ghost"
              size="sm"
              className="h-9 px-3 font-mono text-xs text-neutral-400 hover:text-white hover:bg-neutral-900/80 rounded-lg transition-colors focus-visible:ring-1 focus-visible:ring-neutral-400"
            >
              Sign in
            </LandingSignInButton>

            <LandingContactSalesButton
              variant="ghost"
              size="sm"
              className="h-9 inline-flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900/80 px-3.5 text-xs font-mono font-medium text-neutral-200 transition-all hover:bg-neutral-800 hover:border-neutral-700 hover:text-white shadow-2xs focus-visible:ring-1 focus-visible:ring-neutral-400"
            >
              <Calendar className="h-3.5 w-3.5 text-neutral-400" aria-hidden="true" />
              Book demo
            </LandingContactSalesButton>

            <Link
              href="/command-center"
              className="group h-9 inline-flex items-center gap-1.5 rounded-lg bg-white px-4 text-xs font-mono font-semibold text-black shadow-xs transition-all hover:bg-neutral-200 focus-visible:ring-1 focus-visible:ring-neutral-400"
            >
              <Sparkles className="h-3.5 w-3.5 text-neutral-700" aria-hidden="true" />
              <span>Explore Sandbox</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </div>

          {/* Mobile Menu Hamburger */}
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900/90 text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors lg:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-400"
            aria-expanded={open}
            aria-controls="lp-mobile-menu"
            aria-label={open ? "Close navigation menu" : "Open navigation menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-4.5 w-4.5 text-white" /> : <Menu className="h-4.5 w-4.5 text-neutral-300" />}
          </button>
        </div>

        {/* Mobile Navigation Drawer */}
        <AnimatePresence>
          {open ? (
            <>
              {/* Dimmed backdrop */}
              <motion.div
                key="backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 top-16 z-40 bg-black/75 backdrop-blur-xs lg:hidden"
                onClick={() => setOpen(false)}
                aria-hidden="true"
              />

              {/* Drawer Content */}
              <motion.div
                key="menu"
                id="lp-mobile-menu"
                role="dialog"
                aria-modal="true"
                aria-label="Mobile Navigation"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="relative z-50 overflow-hidden border-t border-neutral-800 bg-[#0c0c0c] px-5 py-6 lg:hidden shadow-2xl"
              >
                <div className="mb-4 flex items-center justify-between pb-3 border-b border-neutral-850">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2" aria-hidden="true">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="font-mono text-xs text-neutral-400">Active Defense Node · Online</span>
                  </div>
                  <span className="font-mono text-[10px] text-neutral-500 uppercase tracking-wider">v1.4</span>
                </div>

                <nav className="flex flex-col gap-1 font-mono text-sm" aria-label="Mobile primary navigation">
                  {NAV_ITEMS.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={(e) => handleNavClick(e, item.href)}
                      className="flex items-center justify-between rounded-lg px-3 py-2.5 text-neutral-300 transition-colors hover:bg-neutral-900 hover:text-white"
                    >
                      <span className="flex items-center gap-2.5">
                        {item.href === "#platform" && <Layers className="h-4 w-4 text-neutral-500" aria-hidden="true" />}
                        {item.href === "/risks" && <Shield className="h-4 w-4 text-neutral-500" aria-hidden="true" />}
                        {item.href === "#integrations" && <Terminal className="h-4 w-4 text-neutral-500" aria-hidden="true" />}
                        {item.href === "/get-started" && <BookOpen className="h-4 w-4 text-neutral-500" aria-hidden="true" />}
                        <span>{item.label}</span>
                      </span>
                      {item.badge ? (
                        <span className="rounded border border-neutral-700/80 bg-neutral-850 px-2 py-0.5 text-[10px] font-mono text-neutral-300">
                          {item.badge}
                        </span>
                      ) : (
                        <ArrowRight className="h-3.5 w-3.5 text-neutral-600" aria-hidden="true" />
                      )}
                    </Link>
                  ))}
                </nav>

                <div className="mt-6 flex flex-col gap-3 border-t border-neutral-850 pt-5">
                  <Link
                    href="/command-center"
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-center font-mono text-xs font-semibold text-black shadow-md hover:bg-neutral-200 transition-colors"
                    onClick={() => setOpen(false)}
                  >
                    <Sparkles className="h-4 w-4 text-neutral-800" aria-hidden="true" />
                    <span>Explore Live Sandbox</span>
                    <ArrowRight className="h-4 w-4 text-black" aria-hidden="true" />
                  </Link>

                  <LandingContactSalesButton
                    variant="ghost"
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900 py-3 text-center font-mono text-xs font-medium text-neutral-200 shadow-2xs hover:bg-neutral-800 hover:text-white transition-colors"
                    onClick={() => setOpen(false)}
                  >
                    <Calendar className="h-4 w-4 text-neutral-400" aria-hidden="true" />
                    <span>Book an Architecture Demo</span>
                  </LandingContactSalesButton>

                  <LandingSignInButton
                    variant="ghost"
                    className="w-full text-center py-2 text-xs font-mono text-neutral-400 hover:text-white transition-colors"
                    onClick={() => setOpen(false)}
                  >
                    Sign in to Customer Portal
                  </LandingSignInButton>
                </div>
              </motion.div>
            </>
          ) : null}
        </AnimatePresence>
      </header>
    </>
  );
}
