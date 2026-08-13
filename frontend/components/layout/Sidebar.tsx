"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import Logo from "@/components/shared/Logo";
import { navSections } from "@/lib/navigation";
import { useAuthRole } from "@/lib/hooks/useAuthRole";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

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
    <aside className="sticky top-0 z-40 hidden h-screen w-64 flex-col border-r border-border bg-card/50 backdrop-blur-xl lg:flex">
      <div className="flex items-center gap-3 border-b border-border p-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg brand-bg-subtle brand-border">
          <Logo iconOnly iconSize={20} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold tracking-tight">ARTSA</span>
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-mono">
              v0.3
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">AI Containment Platform</p>
        </div>
      </div>

      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-6" aria-label="Main navigation">
          {visibleSections.map((section) => (
            <div key={section.label}>
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
                          "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                        aria-current={isActive ? "page" : undefined}
                      >
                        {isActive && (
                          <motion.span
                            layoutId="sidebar-active"
                            className="absolute inset-0 rounded-lg bg-primary/10 ring-1 ring-primary/20"
                            transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                          />
                        )}
                        <Icon className="relative h-4 w-4 shrink-0" aria-hidden />
                        <span className="relative">{item.name}</span>
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
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-xs font-medium text-foreground">Containment SLO</p>
          <p className="mt-1 font-mono text-[11px] text-status-success">&lt;50ms ingest latency</p>
        </div>
      </div>
    </aside>
  );
}
