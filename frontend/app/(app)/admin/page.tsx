"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Cpu, Key, BellRing, Shield, ServerCog, KeyRound, Cable } from "lucide-react";
import { fetchFromBackend } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { DashboardCard } from "@/components/shared/DashboardCard";
import { HubLinkCard } from "@/components/shared/HubLinkCard";
import { PageStack } from "@/components/shared/PageStack";
import { Badge } from "@/components/ui/badge";

interface KeySummary {
  llm_providers_configured: number;
  guardrails_configured: number;
  total_configured: number;
  total_keys: number;
}

export default function AdminOverviewPage() {
  const [registeredProviders, setRegisteredProviders] = useState(0);
  const [keySummary, setKeySummary] = useState<KeySummary | null>(null);
  const [integrationCount, setIntegrationCount] = useState(0);
  const [env, setEnv] = useState<{ environment?: string; default_provider?: string; default_model?: string } | null>(null);

  useEffect(() => {
    fetchFromBackend<{ count?: number }>("/api/v1/providers", { silent: true }).then((d) => {
      if (d?.count != null) setRegisteredProviders(d.count);
    });
    fetchFromBackend<{
      environment?: string;
      default_provider?: string;
      default_model?: string;
      summary?: KeySummary;
    }>("/api/v1/config/keys", { silent: true }).then((d) => {
      if (d?.summary) setKeySummary(d.summary);
      if (d) {
        setEnv({
          environment: d.environment,
          default_provider: d.default_provider,
          default_model: d.default_model,
        });
      }
    });
    fetchFromBackend<{ total?: number }>("/api/v1/alerts/integrations", { silent: true }).then((d) => {
      if (d?.total != null) setIntegrationCount(d.total);
    });
  }, []);

  const stats = [
    {
      label: "Registered providers",
      value: registeredProviders,
      icon: Cpu,
      href: "/admin/providers",
      hint: "User-added API keys (encrypted)",
    },
    {
      label: "Env LLM keys",
      value: keySummary?.llm_providers_configured ?? 0,
      icon: Key,
      href: "/admin/system",
      hint: "Configured via root .env",
    },
    {
      label: "Alert integrations",
      value: integrationCount,
      icon: BellRing,
      href: "/admin/alerts",
      hint: "Webhooks, Slack, SIEM channels",
    },
    {
      label: "Guardrails",
      value: keySummary?.guardrails_configured ?? 0,
      icon: Shield,
      href: "/admin/system",
      hint: "Content safety integrations",
    },
  ];

  return (
    <PageStack>
      <PageHeader
        title="Admin Console"
        description="Platform administration — providers, policies, integrations and system health."
        icon={<ServerCog className="h-5 w-5" />}
        actions={
          env && (
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="meta-badge interactive-pill font-mono capitalize">
                {env.environment}
              </Badge>
              <Badge variant="secondary" className="meta-badge interactive-pill font-mono">
                {env.default_provider} / {env.default_model}
              </Badge>
            </div>
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <HubLinkCard key={s.label} {...s} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DashboardCard title="Provider management" badge={<KeyRound className="h-4 w-4 text-muted-foreground" aria-hidden />}>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Add any LLM API key at runtime — OpenAI, Anthropic, Groq, DeepSeek, local servers or any
            custom OpenAI-compatible endpoint. Keys are encrypted at rest and used by the containment
            proxy via the <code className="code-inline">X-ARTSA-Provider</code> header.
          </p>
          <Link
            href="/admin/providers"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            Manage providers →
          </Link>
        </DashboardCard>

        <DashboardCard title="Alerts & integrations" badge={<Cable className="h-4 w-4 text-muted-foreground" aria-hidden />}>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Route containment alerts to webhooks, Slack, PagerDuty, Splunk or Datadog. Configure
            channels, risk thresholds and test deliveries from the admin console.
          </p>
          <Link
            href="/admin/alerts"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            Manage integrations →
          </Link>
        </DashboardCard>
      </div>
    </PageStack>
  );
}
