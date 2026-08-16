"use client";

import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
      title: "Cryptographic Identity Link",
      desc: "Signed session credentials",
      completed: true,
      tab: "developer" as ProfileTabKey,
    },
    {
      title: "Password Protection",
      desc: hasPasswordSession ? "Configured & encrypted" : "Managed via API Key",
      completed: true,
      tab: "security" as ProfileTabKey,
    },
    {
      title: "Security Clearance",
      desc: `${role.toUpperCase()} clearance`,
      completed: true,
      tab: "general" as ProfileTabKey,
    },
    {
      title: "Recovery Phone",
      desc: hasPhone ? profile?.phone : "Add emergency dispatch phone",
      completed: hasPhone,
      tab: "general" as ProfileTabKey,
    },
  ];

  const completedCount = items.filter((i) => i.completed).length;
  const score = Math.round((completedCount / items.length) * 100);

  return (
    <section
      aria-labelledby="security-health-heading"
      className="rounded-2xl border border-border/80 bg-gradient-to-b from-card to-card/90 p-4.5 shadow-xs space-y-4 transition-all"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-status-success/15 text-status-success shadow-xs">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h2 id="security-health-heading" className="text-xs font-bold text-foreground">
              Security Compliance
            </h2>
            <p className="text-[11px] text-muted-foreground font-mono">{score}% Checklist Rating</p>
          </div>
        </div>

        <Badge
          variant={score >= 80 ? "success" : "warning"}
          className="font-mono text-[10px] shadow-xs"
        >
          {score >= 80 ? "Grade A" : "Needs Review"}
        </Badge>
      </div>

      {/* Progress Bar with accessibility attributes */}
      <div
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Security health score: ${score}%`}
        className="h-2 w-full overflow-hidden rounded-full bg-muted/60 p-0.5 border border-border/50"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-status-success/80 to-status-success transition-all duration-700 ease-out"
          style={{ width: `${score}%` }}
        />
      </div>

      {/* Interactive Checklist Items */}
      <div className="space-y-1.5" role="list" aria-label="Security health checklist">
        {items.map((item) => (
          <button
            key={item.title}
            role="listitem"
            type="button"
            onClick={() => onNavigateTab(item.tab)}
            aria-label={`Jump to ${item.title}: ${item.desc}`}
            className="group flex w-full items-center justify-between rounded-xl p-2.5 text-left transition-all duration-200 hover:bg-muted/50 border border-transparent hover:border-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {item.completed ? (
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-status-success/15 text-status-success">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                </div>
              ) : (
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-severity-medium/15 text-severity-medium">
                  <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-foreground">
                  {item.title}
                </p>
                <p className="truncate text-[10px] text-muted-foreground font-mono">
                  {item.desc}
                </p>
              </div>
            </div>

            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-30 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0.5" aria-hidden="true" />
          </button>
        ))}
      </div>
    </section>
  );
}
