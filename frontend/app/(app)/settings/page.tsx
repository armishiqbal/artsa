"use client";

import { useEffect, useState } from "react";
import {
  Settings2,
  Cable,
  Users,
  Shield,
  Cpu,
  KeyRound,
  ScrollText,
} from "lucide-react";
import { fetchFromBackend } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageStack } from "@/components/shared/PageStack";
import { ReadinessSnapshotPanel } from "@/components/reports/ReadinessSnapshotPanel";
import { SettingsHubCard } from "@/components/shared/SettingsHubCard";
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
      description: "Connect apps, alert channels, Slack, PagerDuty, and webhooks.",
      href: "/settings/integrations",
      icon: Cable,
      stats: [
        { label: "Providers", value: summary.providers },
        { label: "Alert channels", value: summary.integrations },
      ],
    },
    {
      title: "AI Providers",
      description: "Model keys ARTSA uses when executing scans and evaluations.",
      href: "/admin/providers",
      icon: Cpu,
      stats: [{ label: "Registered", value: summary.providers }],
    },
    {
      title: "API Keys",
      description: "Client application keys to authenticate and stream activity to ARTSA.",
      href: "/get-started",
      icon: KeyRound,
      stats: [{ label: "Keys configured", value: summary.keys_configured }],
    },
    {
      title: "Team & Access",
      description: "People, roles, invitations, and administrative access control.",
      href: "/settings/team",
      icon: Users,
      stats: [{ label: "Members", value: summary.team_members }],
    },
    {
      title: "Policies",
      description: "Security boundary guardrails, AI safety policies, and enforcement rules.",
      href: "/admin/policies",
      icon: Shield,
      stats: [{ label: "Guardrails", value: summary.guardrails }],
    },
    {
      title: "Audit Log",
      description: "Complete immutable record of configuration changes and user actions.",
      href: "/settings/audit-log",
      icon: ScrollText,
      stats: [{ label: "Audit entries", value: summary.audit_entries }],
    },
  ];

  return (
    <PageStack>
      <PageHeader
        title="Settings"
        description="Integrations, AI providers, API keys, team access, and security policies."
        icon={<Settings2 className="h-5 w-5" />}
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="interactive-pill font-mono">
              {loaded ? summary.keys_configured : "…"} keys
            </Badge>
            <Badge variant="secondary" className="interactive-pill font-mono">
              {loaded ? summary.guardrails : "…"} guardrails
            </Badge>
          </div>
        }
      />

      <ReadinessSnapshotPanel />

      {loaded ? (
        <div className="flex flex-col gap-3">
          {cards.map((card) => (
            <SettingsHubCard
              key={card.href}
              title={card.title}
              description={card.description}
              href={card.href}
              icon={card.icon}
              stats={card.stats}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border border-border/70 bg-muted/60" />
          ))}
        </div>
      )}
    </PageStack>
  );
}
