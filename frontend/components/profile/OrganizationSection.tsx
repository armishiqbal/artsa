"use client";

import {
  Building2,
  Shield,
  CheckCircle2,
  XCircle,
  Users,
  Layers,
  Crown,
  Lock,
} from "lucide-react";
import Link from "next/link";
import { DashboardCard } from "@/components/shared/DashboardCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { roleLabel, ROLE_VARIANT } from "@/lib/profile";
import type { Profile, TenantInfo } from "./types";

interface OrganizationSectionProps {
  profile: Profile | null;
  role: string;
  tenantInfo?: TenantInfo | null;
}

interface CapabilityItem {
  name: string;
  description: string;
  allowed: boolean;
}

export function OrganizationSection({
  profile,
  role,
  tenantInfo,
}: OrganizationSectionProps) {
  const isAdmin = role === "admin";
  const isAnalyst = role === "analyst";
  const isRedTeam = role === "redteam";
  const isReadonly = role === "readonly";

  const capabilities: CapabilityItem[] = [
    {
      name: "Security Telemetry Ingest",
      description: "Push agent tool calls, traces, and system events to the containment pipeline",
      allowed: !isReadonly,
    },
    {
      name: "Red Team Wargame Campaigns",
      description: "Execute multi-round adversarial red team wargames against target models",
      allowed: isAdmin || isRedTeam,
    },
    {
      name: "Benchmark & Ablation Testing",
      description: "Run containment benchmark harnesses and component ablation evaluations",
      allowed: isAdmin || isRedTeam,
    },
    {
      name: "Containment Policy Governance",
      description: "Create, tune, and publish agent containment rules and kill-chain thresholds",
      allowed: isAdmin,
    },
    {
      name: "LLM Provider Key Management",
      description: "Register, update, and manage encrypted provider credentials and endpoints",
      allowed: isAdmin,
    },
    {
      name: "Outbound Integrations & Webhooks",
      description: "Configure custom outbound HTTP webhooks and telemetry forwarders",
      allowed: isAdmin,
    },
    {
      name: "Incident Forensics & Replay",
      description: "Inspect containment breach logs, session replays, and export compliance reports",
      allowed: true,
    },
  ];

  return (
    <div role="tabpanel" id="panel-organization" aria-labelledby="tab-organization" className="space-y-6">
      {/* Organization / Tenant Overview */}
      <DashboardCard
        title="Organization & Workspace"
        description="Assigned tenant environment and enterprise governance details."
        icon={<Building2 className="h-4 w-4 text-primary" aria-hidden="true" />}
        actions={
          isAdmin ? (
            <Link href="/settings/team">
              <Button size="sm" variant="outline" className="gap-1.5 text-xs shadow-xs">
                <Users className="h-3.5 w-3.5" aria-hidden="true" /> Manage Team
              </Button>
            </Link>
          ) : null
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border/70 bg-card p-4 shadow-xs">
            <span className="text-xs font-semibold text-muted-foreground">Tenant Name</span>
            <div className="mt-2 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" aria-hidden="true" />
              <p className="font-semibold text-foreground truncate">
                {profile?.organization || tenantInfo?.name || "Default Organization"}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-card p-4 shadow-xs">
            <span className="text-xs font-semibold text-muted-foreground">Tenant ID / Slug</span>
            <div className="mt-2 flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" aria-hidden="true" />
              <p className="font-mono text-xs text-foreground truncate">
                {tenantInfo?.slug || "default_org"}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-card p-4 shadow-xs">
            <span className="text-xs font-semibold text-muted-foreground">Plan Tier</span>
            <div className="mt-2 flex items-center gap-2">
              <Crown className="h-4 w-4 text-primary" aria-hidden="true" />
              <Badge variant="outline" className="border-primary/40 text-primary font-mono text-[10px]">
                Enterprise
              </Badge>
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-card p-4 shadow-xs">
            <span className="text-xs font-semibold text-muted-foreground">Assigned Role</span>
            <div className="mt-2 flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" aria-hidden="true" />
              <Badge variant={ROLE_VARIANT[role] ?? "secondary"} className="font-mono text-[10px] uppercase">
                {roleLabel(role)}
              </Badge>
            </div>
          </div>
        </div>
      </DashboardCard>

      {/* Role Capabilities Matrix */}
      <DashboardCard
        title="Role-Based Access Control (RBAC) Capabilities"
        description="Explicit platform permissions granted to your current role tier."
        icon={<Lock className="h-4 w-4 text-primary" aria-hidden="true" />}
      >
        <div className="space-y-3">
          <div className="divide-y divide-border/60 rounded-xl border border-border/80 bg-card overflow-hidden">
            {capabilities.map((cap) => (
              <div
                key={cap.name}
                className="flex items-center justify-between p-3.5 transition-colors hover:bg-muted/20 text-xs"
              >
                <div className="space-y-0.5 pr-4">
                  <p className="font-bold text-foreground">{cap.name}</p>
                  <p className="text-[11px] text-muted-foreground">{cap.description}</p>
                </div>

                <div className="shrink-0">
                  {cap.allowed ? (
                    <Badge
                      variant="success"
                      className="gap-1 px-2.5 py-0.5 font-mono text-[10px]"
                    >
                      <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Granted
                    </Badge>
                  ) : (
                    <Badge
                      variant="secondary"
                      className="gap-1 px-2.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                    >
                      <XCircle className="h-3 w-3" aria-hidden="true" /> Restricted
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>

          {!isAdmin && (
            <p className="text-xs text-muted-foreground pt-1">
              Need additional permissions? Contact an Administrator to adjust your role assignments.
            </p>
          )}
        </div>
      </DashboardCard>
    </div>
  );
}
