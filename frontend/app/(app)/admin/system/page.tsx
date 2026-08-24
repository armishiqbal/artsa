"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Settings2,
  Key,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ShieldCheck,
  Cpu,
  Shield,
  Layers,
} from "lucide-react";
import { fetchFromBackend } from "@/lib/api";
import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";
import { DashboardCard } from "@/components/shared/DashboardCard";
import { StatCard } from "@/components/shared/StatCard";
import { SegmentedControl } from "@/components/shared/SegmentedControl";
import { PageStack } from "@/components/shared/PageStack";
import { StatCardsSkeleton } from "@/components/shared/PageSkeleton";
import { IconTile } from "@/components/shared/IconTile";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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

type FilterCat = "all" | "llm" | "guardrail" | "infra" | "security";

const FILTER_OPTIONS: { value: FilterCat; label: string }[] = [
  { value: "all", label: "All" },
  { value: "llm", label: "LLM" },
  { value: "guardrail", label: "Guardrail" },
  { value: "infra", label: "Infra" },
  { value: "security", label: "Security" },
];

const statusIcon = {
  configured: CheckCircle2,
  missing: XCircle,
  placeholder: AlertCircle,
};

const statusVariant: Record<string, "secondary" | "outline"> = {
  configured: "outline",
  missing: "secondary",
  placeholder: "secondary",
};

function KeyRowItem({ row }: { row: KeyRow }) {
  const Icon = statusIcon[row.status as keyof typeof statusIcon] ?? AlertCircle;

  return (
    <tr className="interactive-row group border-b border-border/50">
      <td className="py-3 pr-4">
        <div className="flex items-center gap-3">
          <IconTile size="sm">
            <Key aria-hidden />
          </IconTile>
          <div>
            <div className="font-medium">{row.label}</div>
            <div className="font-mono text-[10px] text-muted-foreground">{row.id}</div>
          </div>
        </div>
      </td>
      <td className="py-3 pr-4">
        <Badge variant={statusVariant[row.status] ?? "secondary"} className="meta-badge gap-1 capitalize">
          <Icon className="h-3 w-3" aria-hidden />
          {row.status}
        </Badge>
      </td>
      <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{row.preview ?? "—"}</td>
      <td className="py-3 text-xs text-muted-foreground">{row.required_for}</td>
    </tr>
  );
}

export default function AdminSystemPage() {
  const [data, setData] = useState<KeyStatusResponse | null>(null);
  const [proxy, setProxy] = useState<ProxyHealth | null>(null);
  const [query, setQuery] = useState("");
  const [filterCat, setFilterCat] = useState<FilterCat>("all");
  const [searchFocused, setSearchFocused] = useState(false);

  useEffect(() => {
    fetchFromBackend<KeyStatusResponse>("/api/v1/config/keys", { silent: true }).then((d) => {
      if (d) setData(d);
    });
    fetchFromBackend<ProxyHealth>("/api/v1/proxy/health", { silent: true }).then((d) => {
      if (d) setProxy(d);
    });
  }, []);

  const keys = useMemo(() => {
    return (data?.keys ?? []).filter((k) => {
      const q = query.toLowerCase();
      const matchSearch = k.label.toLowerCase().includes(q) || k.id.toLowerCase().includes(q);
      const matchCat = filterCat === "all" || k.category === filterCat;
      return matchSearch && matchCat;
    });
  }, [data?.keys, query, filterCat]);

  const totalKeys = data?.summary.total_keys ?? 0;
  const totalConfigured = data?.summary.total_configured ?? 0;
  const configRatio = totalKeys > 0 ? totalConfigured / totalKeys : 0;

  return (
    <PageStack>
      <PageHeader
        title="System & Keys"
        description="Environment configuration and credential status — secrets are never displayed."
        icon={<Settings2 className="h-5 w-5" />}
        actions={
          data && (
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="meta-badge interactive-pill font-mono capitalize">
                {data.environment}
              </Badge>
              <Badge variant="secondary" className="meta-badge interactive-pill font-mono">
                {data.default_provider} / {data.default_model}
              </Badge>
              <Badge variant="secondary" className="meta-badge interactive-pill font-mono">
                tenant: {data.tenant_id}
              </Badge>
            </div>
          )
        }
      />

      {data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="LLM keys"
              value={data.summary.llm_providers_configured}
              subtitle="Configured via root .env"
              icon={Cpu}
            />
            <StatCard
              label="Guardrails"
              value={data.summary.guardrails_configured}
              subtitle="Content-safety integrations"
              icon={Shield}
            />
            <StatCard
              label="Total configured"
              value={totalKeys ? `${totalConfigured}/${totalKeys}` : totalConfigured}
              subtitle="Keys present vs registered"
              icon={Layers}
              progress={configRatio}
            />
            <StatCard
              label="Containment proxy"
              value={proxy?.enabled ? "Enabled" : "Disabled"}
              subtitle={
                proxy
                  ? `${proxy.mode} · threshold ${proxy.block_threshold} · ${proxy.fail_mode}`
                  : "Loading proxy status…"
              }
              icon={ShieldCheck}
              active={proxy?.enabled}
            />
        </div>
      ) : (
        <StatCardsSkeleton />
      )}

      <DashboardCard
        title="API key status"
        badge={<Key className="h-4 w-4 text-muted-foreground" aria-hidden />}
      >
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div
            className={cn(
              "relative max-w-xs flex-1 rounded-lg",
              searchFocused && "ring-1 ring-foreground/10"
            )}
          >
            <Search
              className={cn(
                "absolute left-3 top-2.5 h-4 w-4 transition-colors",
                searchFocused ? "text-foreground" : "text-muted-foreground"
              )}
              aria-hidden
            />
            <Input
              placeholder="Search keys..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className="pl-9 transition-colors"
            />
          </div>
          <SegmentedControl
            options={FILTER_OPTIONS}
            value={filterCat}
            onChange={setFilterCat}
            layoutId="system-key-filter"
          />
        </div>

        <div className="data-table-wrap">
          <table className="w-full text-sm">
            <thead>
              <tr className="data-table-head">
                <th className="px-3 py-2.5 pr-4 font-medium">Key</th>
                <th className="py-2.5 pr-4 font-medium">Status</th>
                <th className="py-2.5 pr-4 font-medium">Preview</th>
                <th className="py-2.5 font-medium">Purpose</th>
              </tr>
            </thead>
            <tbody>
              {keys.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-10 text-center text-sm text-muted-foreground">
                    No keys match your search or filter.
                  </td>
                </tr>
              ) : (
                keys.map((k) => <KeyRowItem key={k.id} row={k} />)
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Showing {keys.length} credential{keys.length === 1 ? "" : "s"}
          {filterCat !== "all" ? ` in ${filterCat}` : ""}
        </p>
      </DashboardCard>

      <DashboardCard
        title="Runtime providers"
        badge={<ShieldCheck className="h-4 w-4 text-muted-foreground" aria-hidden />}
      >
        <p className="text-sm text-muted-foreground">
          Providers registered at runtime (with encrypted keys) are managed on the{" "}
          <Link
            href="/admin/providers"
            className="font-medium text-foreground underline-offset-4 transition-colors hover:underline"
          >
            Providers
          </Link>{" "}
          page — no env changes or restarts needed.
        </p>
      </DashboardCard>
    </PageStack>
  );
}
