"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { LogoIcon } from "@/components/shared/Logo";
import { navSections } from "@/lib/navigation";
import { useAuthRole } from "@/lib/hooks/useAuthRole";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { identity, capabilities } = useAuthRole();

  const visibleSections = navSections
    .filter((section) => !section.adminOnly || identity.role === "admin")
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => !item.capability || capabilities[item.capability]
      ),
    }))
    .filter((section) => section.items.length > 0);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  // A11y: move focus into the dialog when it opens and restore it on close,
  // so keyboard and screen-reader users are not stranded behind the modal.
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const menuButton = menuButtonRef.current;
    dialog?.focus();
    return () => menuButton?.focus();
  }, [open]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <Button
        ref={menuButtonRef}
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={() => setOpen(true)}
        aria-label="Open navigation menu"
        aria-expanded={open}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <AnimatePresence>
        {open && (
          <>
            <motion.button
              type="button"
              className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              aria-label="Close navigation menu"
            />
            <motion.aside
              ref={dialogRef}
              tabIndex={-1}
              className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-card lg:hidden"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.35 }}
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
            >
              <div className="flex items-center justify-between border-b border-border p-4">
                <div className="flex items-center gap-2">
                  <LogoIcon size={20} className="text-primary" aria-hidden />
                  <span className="font-semibold">ARTSA</span>
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-mono">
                    v0.3
                  </Badge>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close menu">
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <nav className="flex-1 overflow-y-auto p-3" aria-label="Main navigation">
                {visibleSections.map((section) => (
                  <div key={section.label} className="mb-6">
                    <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {section.label}
                    </p>
                    <ul className="space-y-0.5">
                      {section.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;
                        return (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              className={cn(
                                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                                isActive
                                  ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
                              )}
                              aria-current={isActive ? "page" : undefined}
                            >
                              <Icon className="h-4 w-4 shrink-0" aria-hidden />
                              {item.name}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </nav>

              <Separator />
              <div className="p-4">
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-xs font-medium">Containment SLO</p>
                  <p className="mt-1 font-mono text-[11px] text-status-success">&lt;50ms ingest latency</p>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
