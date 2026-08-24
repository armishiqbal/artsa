"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Settings2,
  Cable,
  ScrollText,
  Users,
  BellRing,
  ArrowLeft,
  Webhook,
  Code2,
} from "lucide-react";
import { AdminGuard } from "@/components/AdminGuard";
import { cn } from "@/lib/utils";

const settingsNav = [
  { name: "Overview", href: "/settings", icon: Settings2 },
  { name: "API Setup", href: "/settings/developer", icon: Code2 },
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
            className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Admin
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium">Settings</span>
        </div>

        <div className="flex gap-1 overflow-x-auto pb-1">
          {settingsNav.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/settings" && pathname.startsWith(`${item.href}/`));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                  isActive
                    ? "border-border bg-muted text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {item.name}
              </Link>
            );
          })}
        </div>

        <div className="min-h-[60vh]">{children}</div>
      </div>
    </AdminGuard>
  );
}
