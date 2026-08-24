"use client";

import { CheckCircle2, Circle } from "lucide-react";
import { roleLabel } from "@/lib/profile";
import type { Profile } from "./types";
import type { ProfileTabKey } from "./ProfileSidebarNav";

interface SecurityHealthCardProps {
  profile: Profile | null;
  role: string;
  hasPasswordSession: boolean;
  onNavigateTab: (tab: ProfileTabKey) => void;
}

export function SecurityHealthCard({
  profile,
  role,
  hasPasswordSession,
  onNavigateTab,
}: SecurityHealthCardProps) {
  const hasPhone = Boolean(profile?.phone);

  const items = [
    {
      title: "Session credentials",
      desc: "Signed JWT active",
      completed: true,
      tab: "developer" as ProfileTabKey,
    },
    {
      title: "Password",
      desc: hasPasswordSession ? "Set" : "API key sign-in",
      completed: hasPasswordSession,
      tab: "security" as ProfileTabKey,
    },
    {
      title: "Role",
      desc: roleLabel(role),
      completed: true,
      tab: "general" as ProfileTabKey,
    },
    {
      title: "Recovery phone",
      desc: hasPhone ? profile?.phone ?? "Set" : "Not set",
      completed: hasPhone,
      tab: "general" as ProfileTabKey,
    },
  ];

  const completedCount = items.filter((i) => i.completed).length;

  return (
    <section aria-labelledby="security-health-heading" className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id="security-health-heading" className="text-sm font-medium">
          Security
        </h2>
        <span className="font-mono text-xs text-muted-foreground">
          {completedCount}/{items.length}
        </span>
      </div>

      <ul className="space-y-1" aria-label="Security checklist">
        {items.map((item) => (
          <li key={item.title}>
            <button
              type="button"
              onClick={() => onNavigateTab(item.tab)}
              className="group flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/15"
            >
              {item.completed ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-status-success" aria-hidden />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{item.title}</p>
                <p className="truncate text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
