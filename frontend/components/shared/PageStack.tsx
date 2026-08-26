"use client";

import { cn } from "@/lib/utils";

/** Consistent vertical rhythm — static (no stagger / enter motion). */
export function PageStack({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
  /** @deprecated Ignored — product pages stay still for calmer HCI. */
  stagger?: boolean;
}) {
  return <div className={cn("space-y-6", className)}>{children}</div>;
}
