"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Menu, X } from "lucide-react";
import Logo from "@/components/shared/Logo";
import {
  filterNavItemsByAccess,
  primaryNavItems,
} from "@/lib/navigation";
import { NavItemsList } from "@/components/layout/NavItemsList";
import { UserProfileMenu } from "@/components/layout/UserProfileMenu";
import { useAuthRole } from "@/lib/hooks/useAuthRole";
import { Button } from "@/components/ui/button";

export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const { identity, capabilities } = useAuthRole();
  const reducedMotion = useReducedMotion();

  const visibleItems = filterNavItemsByAccess(
    primaryNavItems,
    capabilities,
    identity.role === "admin"
  );

  useEffect(() => {
    setMounted(true);
  }, []);

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
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const drawerContent = (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" aria-live="assertive">
          {/* Full-screen backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.2 }}
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* Full-height slide-over drawer */}
          <motion.aside
            ref={dialogRef}
            tabIndex={-1}
            className="fixed inset-y-0 left-0 z-50 flex h-[100dvh] w-72 max-w-[85vw] flex-col border-r border-neutral-800 bg-[#0a0a0a] text-white shadow-2xl focus:outline-hidden"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={
              reducedMotion
                ? { duration: 0 }
                : { type: "spring", bounce: 0, duration: 0.3 }
            }
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
          >
            <div className="flex h-14 items-center justify-between border-b border-neutral-800 px-4 bg-[#0a0a0a]">
              <Logo iconSize={20} />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-neutral-400 hover:text-white hover:bg-neutral-800"
                onClick={() => setOpen(false)}
                aria-label="Close navigation menu"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <nav className="flex-1 overflow-y-auto p-3 bg-[#0a0a0a]" aria-label="Main navigation">
              <NavItemsList
                items={visibleItems}
                variant="mobile"
                onNavigate={() => setOpen(false)}
              />
            </nav>

            <div className="border-t border-neutral-800 p-3 bg-[#0a0a0a]">
              <UserProfileMenu onNavigate={() => setOpen(false)} />
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <Button
        ref={menuButtonRef}
        variant="ghost"
        size="icon"
        className="lg:hidden h-9 w-9 text-foreground hover:bg-muted/60"
        onClick={() => setOpen(true)}
        aria-label="Open navigation menu"
        aria-expanded={open}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {mounted && typeof document !== "undefined"
        ? createPortal(drawerContent, document.body)
        : null}
    </>
  );
}
