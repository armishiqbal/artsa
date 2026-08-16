"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Settings2,
  Cable,
  ScrollText,
  Users,
  BellRing,
  ArrowRight,
  Shield,
  Cpu,
} from "lucide-react";
import { fetchFromBackend } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { DashboardCard } from "@/components/shared/DashboardCard";
import { Badge } from "@/components/ui/badge";

interface SettingsSummary {
  providers: number;
  integrations: number;
  team_members: number;
  audit_entries: number;
  keys_configured: number;
  guardrails: number;
  active_channels: number;
}

interface NotificationPrefsShape {
  email_digest_enabled?: boolean;
  slack_enabled?: boolean;
  pagerduty_enabled?: boolean;
  splunk_enabled?: boolean;
  teams_enabled?: boolean;
}

export default function SettingsOverviewPage() {
  const [loaded, setLoaded] = useState(false);
  const [summary, setSummary] = useState<SettingsSummary>({
    providers: 0,
    integrations: 0,
    team_members: 0,
    audit_entries: 0,
    keys_configured: 0,
    guardrails: 0,
    active_channels: 0,
  });

  useEffect(() => {
    Promise.all([
      fetchFromBackend<{ providers?: unknown[] }>("/api/v1/providers", { silent: true }),
      fetchFromBackend<{ total?: number }>("/api/v1/alerts/integrations", { silent: true }),
      fetchFromBackend<{ members?: unknown[] }>("/api/v1/settings/team", { silent: true }),
      // limit=1 + total gives the real event count without pulling the whole log.
      fetchFromBackend<{ total?: number }>("/api/v1/settings/audit-log?limit=1", { silent: true }),
      fetchFromBackend<{ summary?: { total_configured: number; guardrails_configured: number } }>(
        "/api/v1/config/keys",
        { silent: true }
      ),
      fetchFromBackend<{ preferences?: NotificationPrefsShape }>("/api/v1/settings/notifications", { silent: true }),
    ]).then(([providers, integrations, team, audit, keys, notifications]) => {
      const prefs = notifications?.preferences;
      const activeChannels = prefs
        ? [
            prefs.email_digest_enabled,
            prefs.slack_enabled,
            prefs.pagerduty_enabled,
            prefs.splunk_enabled,
            prefs.teams_enabled,
          ].filter(Boolean).length
        : 0;
      setSummary({
        providers: Array.isArray(providers?.providers) ? providers.providers.length : 0,
        integrations: integrations?.total ?? 0,
        team_members: Array.isArray(team?.members) ? team.members.length : 0,
        audit_entries: audit?.total ?? 0,
        keys_configured: keys?.summary?.total_configured ?? 0,
        guardrails: keys?.summary?.guardrails_configured ?? 0,
        active_channels: activeChannels,
      });
      setLoaded(true);
    });
  }, []);

  const cards = [
    {
      title: "Integrations",
      description: "LLM providers, guardrails, and SIEM/SOAR alert channels",
      href: "/settings/integrations",
      icon: Cable,
      stats: [
        { label: "Providers", value: summary.providers },
        { label: "Alert channels", value: summary.integrations },
        { label: "Guardrails", value: summary.guardrails },
      ],
    },
    {
      title: "Team",
      description: "Manage team members, roles, and access control",
      href: "/settings/team",
      icon: Users,
      stats: [{ label: "Members", value: summary.team_members }],
    },
    {
      title: "Notifications",
      description: "Email digests, Slack alerts, PagerDuty, and SIEM routing",
      href: "/settings/notifications",
      icon: BellRing,
      stats: [{ label: "Active channels", value: summary.active_channels }],
    },
    {
      title: "Audit Log",
      description: "Complete record of configuration changes and system events",
      href: "/settings/audit-log",
      icon: ScrollText,
      stats: [{ label: "Events", value: summary.audit_entries }],
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Platform configuration, integrations, team management, and audit trail."
        icon={<Settings2 className="h-5 w-5" />}
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge variant="info" className="font-mono">
              {loaded ? summary.keys_configured : "…"} keys
            </Badge>
            <Badge variant="success" className="font-mono">
              {loaded ? summary.guardrails : "…"} guardrails
            </Badge>
          </div>
        }
      />

      {loaded ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.href}
                href={card.href}
                className="group flex h-full flex-col rounded-xl border border-border bg-card/60 p-6 transition-all hover:border-primary/40 hover:bg-card hover:shadow-lg"
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
                <h3 className="mt-4 text-base font-semibold">{card.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{card.description}</p>
                <div className="mt-auto flex gap-4 pt-4">
                  {card.stats.map((stat) => (
                    <div key={stat.label}>
                      <p className="font-mono text-xl font-semibold">{stat.value}</p>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl border border-border bg-muted/40" />
          ))}
        </div>
      )}

      <DashboardCard
        title="Quick Actions"
        description="Common configuration tasks"
        badge={<Shield className="h-4 w-4 text-status-success" />}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Link
            href="/settings/integrations"
            className="flex items-center gap-3 rounded-lg border border-border p-4 transition-colors hover:border-primary/30 hover:bg-accent/50"
          >
            <Cpu className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium">Add Provider</p>
              <p className="text-xs text-muted-foreground">Connect an LLM backend</p>
            </div>
          </Link>
          <Link
            href="/settings/notifications"
            className="flex items-center gap-3 rounded-lg border border-border p-4 transition-colors hover:border-primary/30 hover:bg-accent/50"
          >
            <BellRing className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium">Configure Alerts</p>
              <p className="text-xs text-muted-foreground">Set up notification channels</p>
            </div>
          </Link>
          <Link
            href="/settings/team"
            className="flex items-center gap-3 rounded-lg border border-border p-4 transition-colors hover:border-primary/30 hover:bg-accent/50"
          >
            <Users className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium">Invite Members</p>
              <p className="text-xs text-muted-foreground">Add team members</p>
            </div>
          </Link>
        </div>
      </DashboardCard>
    </div>
  );
}
