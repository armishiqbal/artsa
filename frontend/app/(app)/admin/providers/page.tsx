"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Cpu,
  Plus,
  Trash2,
  FlaskConical,
  CheckCircle2,
  XCircle,
  Loader2,
  Server,
} from "lucide-react";
import { fetchFromBackend, unwrapEnvelope } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { DashboardCard } from "@/components/shared/DashboardCard";
import { PageStack } from "@/components/shared/PageStack";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/stores/toast";

interface RegisteredProvider {
  id: string;
  name: string;
  provider_type: string;
  api_key_masked: string;
  base_url: string | null;
  default_model: string | null;
  enabled: boolean;
  created_at: string | null;
}

interface CatalogMeta {
  base_url?: string | null;
  description?: string;
  default_model?: string | null;
}

const FORM_INITIAL = {
  name: "",
  provider_type: "deepseek",
  api_key: "",
  base_url: "",
  default_model: "",
  enabled: true,
};

export default function AdminProvidersPage() {
  const [providers, setProviders] = useState<RegisteredProvider[]>([]);
  const [catalog, setCatalog] = useState<Record<string, CatalogMeta>>({});
  const [form, setForm] = useState(FORM_INITIAL);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; detail: string }>>({});

  const loadProviders = useCallback(() => {
    fetchFromBackend<{ providers?: RegisteredProvider[] }>("/api/v1/providers", { silent: true }).then(
      (d) => {
        if (d?.providers) setProviders(d.providers);
      }
    );
  }, []);

  useEffect(() => {
    loadProviders();
    fetchFromBackend<{ catalog?: Record<string, CatalogMeta> }>("/api/v1/providers/catalog", {
      silent: true,
    }).then((d) => {
      if (d?.catalog) setCatalog(d.catalog);
    });
  }, [loadProviders]);

  const selectedCatalog = catalog[form.provider_type];

  const onSave = async () => {
    if (!form.name.trim() || !form.api_key.trim()) {
      toast("Missing fields", { description: "Provider name and API key are required.", variant: "error" });
      return;
    }
    setSaving(true);
    const res = await fetchFromBackend<{ status?: string }>("/api/v1/providers", {
      method: "POST",
      body: JSON.stringify({
        name: form.name,
        api_key: form.api_key,
        provider_type: form.provider_type,
        base_url: form.base_url.trim() || (selectedCatalog?.base_url ?? null),
        default_model: form.default_model.trim() || (selectedCatalog?.default_model ?? null),
        enabled: form.enabled,
      }),
    });
    setSaving(false);
    if (res?.status === "ok") {
      toast("Provider saved", { description: `${form.name} is ready to use via X-ARTSA-Provider.` });
      setForm(FORM_INITIAL);
      loadProviders();
    }
  };

  const onDelete = async (name: string) => {
    const res = await fetchFromBackend<{ status?: string }>(`/api/v1/providers/${name}`, {
      method: "DELETE",
      silent: true,
    });
    if (res?.status === "ok") {
      toast("Provider removed", { description: name });
      loadProviders();
    }
  };

  const onTest = async (name: string) => {
    setTesting(name);
    setTestResults((prev) => ({ ...prev, [name]: { ok: true, detail: "testing..." } }));
    try {
      const raw = await fetch(`/api/backend/api/v1/providers/${name}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = await raw.json().catch(() => ({}));
      const unwrapped = (unwrapEnvelope(body) ?? {}) as { status?: string; reply?: string; detail?: string };
      if (raw.ok && unwrapped?.status === "ok") {
        setTestResults((prev) => ({
          ...prev,
          [name]: { ok: true, detail: `model replied: ${String(unwrapped.reply).slice(0, 80)}` },
        }));
      } else {
        const detail =
          unwrapped?.detail || "test failed — check the key and base URL";
        setTestResults((prev) => ({ ...prev, [name]: { ok: false, detail } }));
      }
    } catch {
      setTestResults((prev) => ({ ...prev, [name]: { ok: false, detail: "network error — could not reach the backend" } }));
    } finally {
      setTesting(null);
    }
  };

  return (
    <PageStack>
      <PageHeader
        title="Provider Management"
        description="Register any LLM API key at runtime — keys are encrypted at rest, never returned, and usable through the containment proxy."
        icon={<Cpu className="h-5 w-5" />}
        actions={<Badge variant="outline" className="meta-badge">{providers.length} registered</Badge>}
      />

      <DashboardCard title="Add provider" description="Any provider type, any model, any OpenAI-compatible base URL.">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Name (slug, used as X-ARTSA-Provider)</label>
            <Input
              placeholder="e.g. my-groq"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Provider type</label>
            <select
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={form.provider_type}
              onChange={(e) => {
                const type = e.target.value;
                const meta = catalog[type];
                setForm({
                  ...form,
                  provider_type: type,
                  base_url: meta?.base_url ?? "",
                  default_model: meta?.default_model ?? "",
                });
              }}
            >
              {Object.entries(catalog).map(([key, meta]) => (
                <option key={key} value={key}>
                  {key} — {meta.description}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">API key</label>
            <Input
              type="password"
              placeholder="sk-..."
              value={form.api_key}
              onChange={(e) => setForm({ ...form, api_key: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Default model</label>
            <Input
              placeholder={selectedCatalog?.default_model ?? "any model"}
              value={form.default_model}
              onChange={(e) => setForm({ ...form, default_model: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Base URL (custom OpenAI-compatible endpoint — leave empty for the provider default)
            </label>
            <Input
              placeholder={selectedCatalog?.base_url ?? "https://api.example.com/v1"}
              value={form.base_url}
              onChange={(e) => setForm({ ...form, base_url: e.target.value })}
            />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              className="h-4 w-4 rounded border-border"
            />
            Enabled (visible to the proxy)
          </label>
          <Button onClick={onSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
            {providers.some((p) => p.name === form.name.trim()) ? "Update provider" : "Add provider"}
          </Button>
        </div>
      </DashboardCard>

      <DashboardCard title="Registered providers" description="Keys are stored encrypted and shown masked only.">
        {providers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No runtime providers yet. Add one above — DeepSeek and other env-configured keys are still
            available through their provider names.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-4">Name</th>
                  <th className="pb-2 pr-4">Type</th>
                  <th className="pb-2 pr-4">Key</th>
                  <th className="pb-2 pr-4">Base URL</th>
                  <th className="pb-2 pr-4">Model</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {providers.map((p) => {
                  const test = testResults[p.name];
                  return (
                    <tr key={p.id} className="border-b border-border/50">
                      <td className="py-2.5 pr-4 font-medium">{p.name}</td>
                      <td className="py-2.5 pr-4">
                        <Badge variant="secondary" className="font-mono text-[10px]">
                          {p.provider_type}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-4 font-mono text-xs text-muted-foreground">{p.api_key_masked}</td>
                      <td className="max-w-[220px] truncate py-2.5 pr-4 font-mono text-xs text-muted-foreground">
                        {p.base_url ?? "default"}
                      </td>
                      <td className="max-w-[160px] truncate py-2.5 pr-4 font-mono text-xs text-muted-foreground">
                        {p.default_model ?? "any"}
                      </td>
                      <td className="py-2.5 pr-4">
                        <Badge variant={p.enabled ? "success" : "secondary"} className="text-[10px]">
                          {p.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </td>
                      <td className="py-2.5 text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => onTest(p.name)} disabled={testing === p.name}>
                            {testing === p.name ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                            ) : (
                              <FlaskConical className="h-3.5 w-3.5" aria-hidden />
                            )}
                            Test
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
                            onClick={() => onDelete(p.name)}
                            aria-label={`Delete provider ${p.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          </Button>
                        </div>
                        {test && (
                          <p className={`mt-1 flex items-center gap-1 text-right text-[11px] ${test.ok ? "text-status-success" : "text-destructive"}`}>
                            {test.ok ? <CheckCircle2 className="h-3 w-3" aria-hidden /> : <XCircle className="h-3 w-3" aria-hidden />}
                            {test.detail}
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </DashboardCard>

      <DashboardCard title="All supported APIs" description="Pick a type above or register any custom OpenAI-compatible endpoint.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(catalog).map(([key, meta]) => (
            <div key={key} className="flex items-start gap-2.5 rounded-lg border border-border/60 p-3">
              <Server className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0">
                <p className="font-mono text-xs font-semibold">{key}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{meta.description}</p>
                <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground/70">{meta.base_url ?? "custom"}</p>
              </div>
            </div>
          ))}
        </div>
      </DashboardCard>
    </PageStack>
  );
}
