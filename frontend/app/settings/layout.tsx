"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Settings2,
  Cable,
  ScrollText,
  Users,
  BellRing,
  ArrowLeft,
  Webhook,
} from "lucide-react";
import { AdminGuard } from "@/components/AdminGuard";
import { cn } from "@/lib/utils";

const settingsNav = [
  { name: "Overview", href: "/settings", icon: Settings2 },
  { name: "Integrations", href: "/settings/integrations", icon: Cable },
  { name: "Custom Outbound", href: "/settings/integrations/custom", icon: Webhook },
  { name: "Audit Log", href: "/settings/audit-log", icon: ScrollText },
  { name: "Team", href: "/settings/team", icon: Users },
  { name: "Notifications", href: "/settings/notifications", icon: BellRing },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AdminGuard>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Admin
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium">Settings</span>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {settingsNav.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="settings-tab"
                    className="absolute inset-0 rounded-lg bg-primary/10 ring-1 ring-primary/20"
                    transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                  />
                )}
                <Icon className="relative h-4 w-4 shrink-0" />
                <span className="relative">{item.name}</span>
              </Link>
            );
          })}
        </div>

        <div className="min-h-[60vh]">{children}</div>
      </div>
    </AdminGuard>
  );
}
