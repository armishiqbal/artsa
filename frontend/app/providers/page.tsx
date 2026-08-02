"use client";

import { useEffect, useState } from "react";
import { Cpu, Search, ShieldCheck, Key, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { fetchFromBackend } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { DashboardCard } from "@/components/shared/DashboardCard";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ProviderRow {
  id: string;
  name: string;
  type: string;
  model: string;
  configured: boolean;
}

interface KeyRow {
  id: string;
  label: string;
  category: string;
  status: string;
  configured: boolean;
  preview: string | null;
  required_for: string;
}

const statusIcon = {
  configured: CheckCircle2,
  missing: XCircle,
  placeholder: AlertCircle,
};

const statusVariant = {
  configured: "success" as const,
  missing: "secondary" as const,
  placeholder: "warning" as const,
};

export default function ProvidersPage() {
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [summary, setSummary] = useState<{ llm_providers_configured: number; guardrails_configured: number } | null>(null);
  const [guardrails, setGuardrails] = useState<Record<string, boolean>>({});
  const [gatewayMessage, setGatewayMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCat, setFilterCat] = useState("all");

  useEffect(() => {
    fetchFromBackend<{
      providers?: ProviderRow[];
      guardrails?: Record<string, boolean>;
      api_gateway?: { status?: string; message?: string };
    }>("/api/v1/config/providers", { silent: true }).then((data) => {
      if (data?.providers) setProviders(data.providers);
      if (data?.guardrails) setGuardrails(data.guardrails);
      if (data?.api_gateway?.status === "fully_connected") {
        setGatewayMessage(data.api_gateway.message ?? "Unified API on port 8000");
      } else {
        setGatewayMessage(null);
      }
    });
    fetchFromBackend<{ keys?: KeyRow[]; summary?: { llm_providers_configured: number; guardrails_configured: number } }>(
      "/api/v1/config/keys",
      { silent: true }
    ).then((data) => {
      if (data?.keys) setKeys(data.keys);
      if (data?.summary) setSummary(data.summary);
    });
  }, []);

  const filteredKeys = keys.filter((k) => {
    const q = searchQuery.toLowerCase();
    const matchSearch = k.label.toLowerCase().includes(q) || k.id.toLowerCase().includes(q);
    const matchCat = filterCat === "all" || k.category === filterCat;
    return matchSearch && matchCat;
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Provider & Key Registry"
        description="LLM backends and guardrail integrations — configured via root .env (never exposed to browser)."
        icon={<Cpu className="h-5 w-5" />}
        actions={
          summary && (
            <div className="flex gap-2">
              <Badge variant="success">{summary.llm_providers_configured} LLM keys</Badge>
              <Badge variant="info">{summary.guardrails_configured} guardrails</Badge>
            </div>
          )
        }
      />

      {gatewayMessage && (
        <DashboardCard
          title="API gateway"
          badge={
            <Badge variant="success" className="text-[10px]">
              Fully connected
            </Badge>
          }
        >
          <p className="text-sm text-muted-foreground">{gatewayMessage}</p>
        </DashboardCard>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {providers.map((p) => (
          <DashboardCard
            key={p.id}
            title={p.name}
            badge={
              <Badge variant={p.configured ? "success" : "secondary"} className="text-[10px]">
                {p.configured ? "Ready" : "No key"}
              </Badge>
            }
          >
            <p className="font-mono text-xs text-primary">{p.model}</p>
            <p className="mt-1 text-xs capitalize text-muted-foreground">{p.type.replace("_", " ")}</p>
          </DashboardCard>
        ))}
      </div>

      <DashboardCard title="Guardrail Stack" badge={<ShieldCheck className="h-4 w-4 text-emerald-400" />}>
        <div className="flex flex-wrap gap-3">
          {Object.entries(guardrails).map(([name, active]) => (
            <Badge key={name} variant={active ? "success" : "secondary"} className="gap-1 font-mono text-xs capitalize">
              {active ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
              {name.replace("_", " ")}
            </Badge>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Set <code className="text-foreground">LAKERA_API_KEY</code> and{" "}
          <code className="text-foreground">AZURE_CONTENT_SAFETY_KEY</code> in <code className="text-foreground">.env</code>{" "}
          then restart the backend.
        </p>
      </DashboardCard>

      <DashboardCard title="API Key Status" badge={<Key className="h-4 w-4" />}>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search keys…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
          </div>
          <div className="flex flex-wrap gap-1">
            {["all", "llm", "guardrail", "infra", "security"].map((cat) => (
              <Button key={cat} variant={filterCat === cat ? "default" : "ghost"} size="sm" className="text-xs capitalize" onClick={() => setFilterCat(cat)}>
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
              {filteredKeys.map((k) => {
                const Icon = statusIcon[k.status as keyof typeof statusIcon] ?? AlertCircle;
                return (
                  <tr key={k.id} className="border-b border-border/50">
                    <td className="py-2.5 pr-4">
                      <div className="font-medium">{k.label}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{k.id}</div>
                    </td>
                    <td className="py-2.5 pr-4">
                      <Badge variant={statusVariant[k.status as keyof typeof statusVariant] ?? "secondary"} className="gap-1 text-[10px] capitalize">
                        <Icon className="h-3 w-3" />
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

      <DashboardCard title="Setup" description="Keys are loaded from repo root .env">
        <pre className="overflow-x-auto rounded-lg border border-border bg-zinc-950 p-4 font-mono text-xs text-emerald-400">
{`# One-time setup
cp .env.example .env
# Edit .env with your keys, then:
npm run setup:env    # merge new keys without losing existing values
npm run dev          # start platform

# Verify
curl http://localhost:8000/api/v1/config/keys`}
        </pre>
      </DashboardCard>
    </div>
  );
}
