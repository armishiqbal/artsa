"use client";

import { useEffect, useState } from "react";
import { Settings2, Key, Search, CheckCircle2, XCircle, AlertCircle, ShieldCheck } from "lucide-react";
import { fetchFromBackend } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { DashboardCard } from "@/components/shared/DashboardCard";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface KeyRow {
  id: string;
  label: string;
  category: string;
  status: string;
  configured: boolean;
  preview: string | null;
  required_for: string;
}

interface KeyStatusResponse {
  environment: string;
  default_provider: string;
  default_model: string;
  tenant_id: string;
  summary: {
    llm_providers_configured: number;
    guardrails_configured: number;
    total_configured: number;
    total_keys: number;
  };
  keys: KeyRow[];
}

interface ProxyHealth {
  enabled: boolean;
  mode: string;
  block_threshold: number;
  fail_mode: string;
  default_provider: string;
}

const statusIcon = {
  configured: CheckCircle2,
  missing: XCircle,
  placeholder: AlertCircle,
};

const statusVariant: Record<string, "success" | "secondary" | "warning"> = {
  configured: "success",
  missing: "secondary",
  placeholder: "warning",
};

export default function AdminSystemPage() {
  const [data, setData] = useState<KeyStatusResponse | null>(null);
  const [proxy, setProxy] = useState<ProxyHealth | null>(null);
  const [query, setQuery] = useState("");
  const [filterCat, setFilterCat] = useState("all");

  useEffect(() => {
    fetchFromBackend<KeyStatusResponse>("/api/v1/config/keys", { silent: true }).then((d) => {
      if (d) setData(d);
    });
    fetchFromBackend<ProxyHealth>("/api/v1/proxy/health", { silent: true }).then((d) => {
      if (d) setProxy(d);
    });
  }, []);

  const keys = (data?.keys ?? []).filter((k) => {
    const q = query.toLowerCase();
    const matchSearch = k.label.toLowerCase().includes(q) || k.id.toLowerCase().includes(q);
    const matchCat = filterCat === "all" || k.category === filterCat;
    return matchSearch && matchCat;
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="System & Keys"
        description="Environment configuration and credential status — secrets are never displayed."
        icon={<Settings2 className="h-5 w-5" />}
        actions={
          data && (
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="font-mono text-[10px] capitalize">
                {data.environment}
              </Badge>
              <Badge variant="info" className="font-mono text-[10px]">
                {data.default_provider} / {data.default_model}
              </Badge>
              <Badge variant="warning" className="font-mono text-[10px]">
                tenant: {data.tenant_id}
              </Badge>
            </div>
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard title="LLM keys" badge={<Badge variant="success" className="text-[10px]">{data?.summary.llm_providers_configured ?? 0}</Badge>}>
          <p className="text-sm text-muted-foreground">Configured via root .env</p>
        </DashboardCard>
        <DashboardCard title="Guardrails" badge={<Badge variant="success" className="text-[10px]">{data?.summary.guardrails_configured ?? 0}</Badge>}>
          <p className="text-sm text-muted-foreground">Content-safety integrations</p>
        </DashboardCard>
        <DashboardCard title="Total configured" badge={<Badge variant="info" className="text-[10px]">{data?.summary.total_configured ?? 0}/{data?.summary.total_keys ?? 0}</Badge>}>
          <p className="text-sm text-muted-foreground">Keys present vs registered</p>
        </DashboardCard>
        <DashboardCard title="Containment proxy" badge={<Badge variant={proxy?.enabled ? "success" : "secondary"} className="text-[10px]">{proxy?.enabled ? "Enabled" : "Disabled"}</Badge>}>
          <p className="font-mono text-xs text-muted-foreground">
            {proxy?.mode} · threshold {proxy?.block_threshold} · {proxy?.fail_mode}
          </p>
        </DashboardCard>
      </div>

      <DashboardCard
        title="API key status"
        badge={<Key className="h-4 w-4 text-primary" aria-hidden />}
      >
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
            <Input
              placeholder="Search keys..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {["all", "llm", "guardrail", "infra", "security"].map((cat) => (
              <Button
                key={cat}
                variant={filterCat === cat ? "default" : "ghost"}
                size="sm"
                className="text-xs capitalize"
                onClick={() => setFilterCat(cat)}
              >
                {cat}
              </Button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="pb-2 pr-4">Key</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Preview</th>
                <th className="pb-2">Purpose</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => {
                const Icon = statusIcon[k.status as keyof typeof statusIcon] ?? AlertCircle;
                return (
                  <tr key={k.id} className="border-b border-border/50">
                    <td className="py-2.5 pr-4">
                      <div className="font-medium">{k.label}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{k.id}</div>
                    </td>
                    <td className="py-2.5 pr-4">
                      <Badge variant={statusVariant[k.status] ?? "secondary"} className="gap-1 text-[10px] capitalize">
                        <Icon className="h-3 w-3" aria-hidden />
                        {k.status}
                      </Badge>
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-xs text-muted-foreground">{k.preview ?? "—"}</td>
                    <td className="py-2.5 text-xs text-muted-foreground">{k.required_for}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </DashboardCard>

      <DashboardCard title="Runtime providers" badge={<ShieldCheck className="h-4 w-4 text-status-success" aria-hidden />}>
        <p className="text-sm text-muted-foreground">
          Providers registered at runtime (with encrypted keys) are managed on the{" "}
          <a href="/admin/providers" className="text-primary hover:underline">
            Providers
          </a>{" "}
          page — no env changes or restarts needed.
        </p>
      </DashboardCard>
    </div>
  );
}
