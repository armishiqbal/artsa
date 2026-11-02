"use client";

import type { ComponentProps } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLandingContactOptional } from "./LandingContactContext";

type Props = Omit<ComponentProps<typeof Button>, "onClick" | "asChild"> & {
  onClick?: ComponentProps<typeof Button>["onClick"];
};

function scrollToContact() {
  const el = document.getElementById("contact");
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    // Focus first field for keyboard / SR users
    window.setTimeout(() => {
      document.getElementById("section-contact-first")?.focus();
    }, 400);
  }
}

/** Opens the Contact Sales modal in-place when within LandingContactProvider (no scrolling), or scrolls to #contact as fallback. */
export function LandingContactSalesButton({
  children = "Contact sales",
  className,
  onClick,
  ...props
}: Props) {
  const contactCtx = useLandingContactOptional();

  return (
    <Button
      type="button"
      className={cn(className)}
      {...props}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        if (contactCtx) {
          contactCtx.openContactSales();
        } else {
          scrollToContact();
        }
      }}
    >
      {children}
    </Button>
  );
}

/** Same destination as a plain anchor (nav / footer). */
export function LandingContactSalesLink({
  children = "Contact sales",
  className,
  onNavigate,
}: {
  children?: React.ReactNode;
  className?: string;
  onNavigate?: () => void;
}) {
  const contactCtx = useLandingContactOptional();

  return (
    <Link
      href="#contact"
      className={className}
      onClick={(e) => {
        onNavigate?.();
        if (contactCtx) {
          e.preventDefault();
          contactCtx.openContactSales();
        } else {
          // Next Link + hash: ensure smooth scroll after navigation
          requestAnimationFrame(() => scrollToContact());
        }
      }}
    >
      {children}
    </Link>
  );
}

export { scrollToContact };
