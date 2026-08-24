"use client";

import {
  User,
  Shield,
  Sliders,
  Code2,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ProfileTabKey =
  | "general"
  | "security"
  | "preferences"
  | "developer";

interface NavItem {
  key: ProfileTabKey;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  {
    key: "general",
    label: "My Profile",
    description: "Name, photo, and identity",
    icon: User,
  },
  {
    key: "security",
    label: "Password & Security",
    description: "Password and sign-in protection",
    icon: Shield,
  },
  {
    key: "preferences",
    label: "Preferences",
    description: "Alerts, sound, and regional time",
    icon: Sliders,
  },
  {
    key: "developer",
    label: "API & Developer",
    description: "API keys and integration guides",
    icon: Code2,
  },
];

interface ProfileSidebarNavProps {
  activeTab: ProfileTabKey;
  onSelectTab: (tab: ProfileTabKey) => void;
}

export function ProfileSidebarNav({
  activeTab,
  onSelectTab,
}: ProfileSidebarNavProps) {
  return (
    <nav
      role="tablist"
      aria-orientation="vertical"
      aria-label="Profile navigation"
      className="flex flex-col gap-1"
    >
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.key;
        return (
          <button
            key={item.key}
            role="tab"
            id={`tab-${item.key}`}
            aria-controls={`panel-${item.key}`}
            aria-selected={isActive}
            tabIndex={0}
            type="button"
            onClick={() => onSelectTab(item.key)}
            className={cn(
              "group flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/15",
              isActive
                ? "border-border bg-muted font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border",
                  isActive
                    ? "border-border bg-background text-foreground"
                    : "border-border/70 bg-muted/30 text-muted-foreground group-hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm leading-tight">{item.label}</p>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{item.description}</p>
              </div>
            </div>

            <ChevronRight
              className={cn(
                "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                isActive && "translate-x-0.5 text-foreground"
              )}
              aria-hidden
            />
          </button>
        );
      })}
    </nav>
  );
}
