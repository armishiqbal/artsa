"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoIcon, LogoWordmark } from "@/components/shared/Logo";
import { navSections } from "@/lib/navigation";
import { useAuthRole } from "@/lib/hooks/useAuthRole";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Rocket } from "lucide-react";

export default function Sidebar() {
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

  return (
    <aside className="shell-sidebar sticky top-0 z-40 hidden h-screen w-64 flex-col lg:flex">
      <Link
        href="/dashboard"
        className="flex items-center gap-3 border-b border-border p-5 transition-colors hover:bg-muted/25"
      >
        <LogoIcon size={22} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <LogoWordmark size={22} />
            <Badge variant="secondary" className="meta-badge shrink-0 font-mono">
              v0.3
            </Badge>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">AI Containment</p>
        </div>
      </Link>

      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1" aria-label="Main navigation">
          {visibleSections.map((section, sectionIndex) => (
            <div
              key={section.label}
              className={cn(sectionIndex > 0 && "nav-section-block", sectionIndex === 0 && "pb-1")}
            >
              <p className="nav-section-label">{section.label}</p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/dashboard" &&
                      item.href !== "/get-started" &&
                      pathname.startsWith(`${item.href}/`));
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        data-active={isActive ? "true" : "false"}
                        className={cn(
                          "interactive-nav flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] font-medium tracking-[-0.17px] transition-colors",
                          isActive
                            ? "text-foreground"
                            : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                        )}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0",
                            isActive ? "text-foreground" : "text-muted-foreground"
                          )}
                          aria-hidden
                        />
                        <span className="truncate">{item.name}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </ScrollArea>

      <Separator />
      <div className="p-4">
        <Link
          href="/get-started"
          className="flex items-center gap-2 rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5 text-xs font-medium transition-colors hover:border-foreground/15 hover:bg-muted/40"
        >
          <Rocket className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          Setup checklist
        </Link>
      </div>
    </aside>
  );
}
