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
      className="flex flex-col gap-1.5"
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
              "group relative flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              isActive
                ? "bg-primary/10 text-primary font-bold border border-primary/30 shadow-xs ring-1 ring-primary/15"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground border border-transparent"
            )}
          >
            {/* Active Left Indicator Bar */}
            {isActive && (
              <span
                className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-primary"
                aria-hidden="true"
              />
            )}

            <div className="flex items-center gap-3 min-w-0">
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-all duration-200",
                  isActive
                    ? "border-primary/40 bg-primary/20 text-primary shadow-xs"
                    : "border-border/70 bg-muted/30 text-muted-foreground group-hover:text-foreground group-hover:border-border"
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </div>

              <div className="min-w-0">
                <p className="truncate text-xs font-semibold leading-tight">
                  {item.label}
                </p>
                <p className="truncate text-[11px] text-muted-foreground mt-0.5 font-normal">
                  {item.description}
                </p>
              </div>
            </div>

            <ChevronRight
              className={cn(
                "h-4 w-4 shrink-0 transition-transform duration-200 opacity-30 group-hover:opacity-100",
                isActive ? "opacity-100 text-primary translate-x-0.5" : "text-muted-foreground"
              )}
              aria-hidden="true"
            />
          </button>
        );
      })}
    </nav>
  );
}
