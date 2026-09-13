"use client";

import Link from "next/link";
import { LogoIcon, LogoWordmark } from "@/components/shared/Logo";
import {
  filterNavItemsByAccess,
  primaryNavItems,
} from "@/lib/navigation";
import { NavItemsList } from "@/components/layout/NavItemsList";
import { useAuthRole } from "@/lib/hooks/useAuthRole";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function Sidebar() {
  const { identity, capabilities } = useAuthRole();

  const visibleItems = filterNavItemsByAccess(
    primaryNavItems,
    capabilities,
    identity.role === "admin"
  );

  return (
    <aside className="shell-sidebar sticky top-0 z-40 hidden h-screen w-64 flex-col lg:flex">
      <Link
        href="/command-center"
        className="flex items-center gap-3 border-b border-border px-5 py-4 transition-colors hover:bg-muted/25"
      >
        <LogoIcon size={22} />
        <LogoWordmark size={22} />
      </Link>

      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1" aria-label="Main navigation">
          <div className={cn("pb-1")}>
            <NavItemsList items={visibleItems} variant="desktop" />
          </div>
        </nav>
      </ScrollArea>
    </aside>
  );
}
