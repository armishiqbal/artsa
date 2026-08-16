"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Cable,
  Plus,
  Trash2,
  FlaskConical,
  CheckCircle2,
  XCircle,
  Loader2,
  Pencil,
  Webhook,
  KeyRound,
  ChevronLeft,
  GripVertical,
} from "lucide-react";
import { fetchFromBackend, unwrapEnvelope } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { DashboardCard } from "@/components/shared/DashboardCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/stores/toast";
import { useAuthRole } from "@/lib/hooks/useAuthRole";
import { extractSecretRefs, buildSampleTemplate, usesDefaultPayload, validatePayloadTemplate } from "@/lib/integrationTemplates";
import type { AuthType, CustomIntegration, CustomIntegrationSchema, EventType } from "@/lib/types";

const EVENT_TYPES: EventType[] = ["alert", "tool_call", "proxy_call", "session_action"];
const METHODS = ["POST", "PUT", "PATCH"];

const AUTH_LABELS: Record<AuthType, string> = {
  none: "None",
  bearer: "Bearer token",
  basic: "Basic auth",
  api_key: "API key (X-API-Key)",
};

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface HeaderRow {
  key: string;
  value: string;
}

interface ConnectorForm {
  name: string;
  description: string;
  method: "POST" | "PUT" | "PATCH";
  target_url: string;
  auth_type: AuthType;
  headers: HeaderRow[];
  payload_template: string;
  use_default_payload: boolean;
  event_types: EventType[];
  risk_threshold: string;
  enabled: boolean;
  retries: string;
  timeout: string;
  secrets: Record<string, string>;
}

const EMPTY_FORM: ConnectorForm = {
  name: "",
  description: "",
  method: "POST",
  target_url: "",
  auth_type: "none",
  headers: [],
  payload_template: "",
  use_default_payload: true,
  event_types: ["alert"],
  risk_threshold: "0",
  enabled: true,
  retries: "3",
  timeout: "10",
  secrets: {},
};

function formFromIntegration(integration: CustomIntegration): ConnectorForm {
  return {
    name: integration.name,
    description: integration.description ?? "",
    method: integration.method,
    target_url: integration.target_url,
    auth_type: integration.auth_type,
    headers: Object.entries(integration.headers).map(([key, value]) => ({ key, value })),
    payload_template: integration.payload_template ?? "",
    use_default_payload: usesDefaultPayload(integration),
    event_types: [...integration.event_types],
    risk_threshold: String(integration.risk_threshold),
    enabled: integration.enabled,
    retries: String(integration.retries),
    timeout: String(integration.timeout),
    secrets: {},
  };
}

// ---------------------------------------------------------------------------
// Connector form card
// ---------------------------------------------------------------------------

// Preserve a legitimate 0 (e.g. "no retries") while keeping a fallback default
// for empty/invalid input — `Number(x) || default` would coerce 0 to the default.
function numOr(raw: string, fallback: number): number {
  const n = Number(raw);
  return raw.trim() === "" || !Number.isFinite(n) ? fallback : n;
}

function ConnectorFormCard({
  schema,
  editing,
  onSaved,
  onCancel,
}: {
  schema: CustomIntegrationSchema | null;
  editing: null | "new" | CustomIntegration;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const isEdit = editing !== null && editing !== "new";
  const [form, setForm] = useState<ConnectorForm>(() =>
    isEdit ? formFromIntegration(editing) : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);

  const authInfo = useMemo(
    () => schema?.auth_types.find((a) => a.type === form.auth_type),
    [schema, form.auth_type]
  );

  const set = <K extends keyof ConnectorForm>(key: K, value: ConnectorForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const referencedSecrets = useMemo(
    () =>
      extractSecretRefs(
        Object.fromEntries(form.headers.map((h) => [h.key, h.value])),
        form.use_default_payload ? null : form.payload_template
      ),
    [form.headers, form.payload_template, form.use_default_payload]
  );

  const toggleEventType = (t: EventType) =>
    set(
      "event_types",
      form.event_types.includes(t)
        ? form.event_types.filter((x) => x !== t)
        : [...form.event_types, t]
    );

  const setHeader = (idx: number, key: string, value: string) =>
    set(
      "headers",
      form.headers.map((h, i) => (i === idx ? { key, value } : h))
    );

  const validate = (): string | null => {
    if (!form.name.trim()) return "Connector name is required.";
    if (!form.target_url.trim()) return "Target URL is required.";
    if (!form.event_types.length) return "Select at least one event type.";
    if (!form.use_default_payload) {
      const err = validatePayloadTemplate(form.payload_template);
      if (err) return `Payload template is not valid JSON: ${err}`;
    }
    return null;
  };

  const save = async () => {
    const err = validate();
    if (err) {
      toast("Invalid connector", { description: err, variant: "error" });
      return;
    }
    setSaving(true);

    const headers = Object.fromEntries(
      form.headers.filter((h) => h.key.trim()).map((h) => [h.key.trim(), h.value])
    );

    const body = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      method: form.method,
      target_url: form.target_url.trim(),
      auth_type: form.auth_type,
      headers,
      payload_template: form.use_default_payload ? null : form.payload_template,
      event_types: form.event_types,
      risk_threshold: Math.max(0, Math.min(100, numOr(form.risk_threshold, 0))),
      enabled: form.enabled,
      retries: Math.max(0, Math.min(10, numOr(form.retries, 3))),
      timeout: Math.max(1, Math.min(120, numOr(form.timeout, 10))),
      secrets: form.secrets,
    };

    const res = await fetchFromBackend<{ status?: string }>(
      isEdit ? `/api/v1/integrations/${form.name.trim()}` : "/api/v1/integrations",
      { method: isEdit ? "PATCH" : "POST", body: JSON.stringify(body) }
    );
    setSaving(false);
    if (res?.status === "ok") {
      toast(isEdit ? "Connector updated" : "Connector created", {
        description: form.name.trim(),
      });
      onSaved();
    }
  };

  return (
    <DashboardCard
      title={isEdit ? `Edit ${editing.name}` : "New Connector"}
      description={
        isEdit
          ? "Secrets left blank are preserved. Empty-string secrets are removed."
          : "Connect ARTSA to any HTTP system — no code required."
      }
      badge={
        <Button variant="ghost" size="sm" className="text-xs" onClick={onCancel}>
          <ChevronLeft className="h-3.5 w-3.5" /> Back to list
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Name (slug)</label>
          <Input
            placeholder="e.g. my-siem"
            value={form.name}
            disabled={isEdit}
            onChange={(e) => set("name", e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Description</label>
          <Input
            placeholder="What does this connector deliver to?"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Method</label>
          <select
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            value={form.method}
            onChange={(e) => set("method", e.target.value as ConnectorForm["method"])}
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Target URL</label>
          <Input
            placeholder="https://sink.example.com/ingest"
            value={form.target_url}
            onChange={(e) => set("target_url", e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Auth</label>
          <select
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            value={form.auth_type}
            onChange={(e) => set("auth_type", e.target.value as AuthType)}
          >
            {(schema?.auth_types ?? []).map((a) => (
              <option key={a.type} value={a.type}>{AUTH_LABELS[a.type]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Risk threshold</label>
          <Input
            type="number"
            min={0}
            max={100}
            value={form.risk_threshold}
            onChange={(e) => set("risk_threshold", e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Retries</label>
          <Input
            type="number"
            min={0}
            max={10}
            value={form.retries}
            onChange={(e) => set("retries", e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Timeout (s)</label>
          <Input
            type="number"
            min={1}
            max={120}
            value={form.timeout}
            onChange={(e) => set("timeout", e.target.value)}
          />
        </div>
      </div>

      {/* Auth secrets */}
      {authInfo && authInfo.secrets.length > 0 && (
        <div className="mt-4 rounded-lg border border-border/60 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <KeyRound className="h-3.5 w-3.5" /> Auth secrets — {authInfo.header}
          </p>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {authInfo.secrets.map((name) => (
              <div key={name}>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">{name}</label>
                <Input
                  type="password"
                  placeholder={isEdit ? "•••••••• (unchanged)" : `enter ${name}`}
                  value={form.secrets[name] ?? ""}
                  onChange={(e) => set("secrets", { ...form.secrets, [name]: e.target.value })}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Custom headers */}
      <div className="mt-4">
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          Custom headers <span className="font-normal text-muted-foreground/60">(values may embed {"{{secret:name}}"})</span>
        </p>
        <div className="space-y-2">
          {form.headers.map((h, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/40" />
              <Input
                placeholder="Header"
                value={h.key}
                onChange={(e) => setHeader(idx, e.target.value, h.value)}
                className="w-48"
              />
              <Input
                placeholder="Value"
                value={h.value}
                onChange={(e) => setHeader(idx, h.key, e.target.value)}
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-9 text-destructive hover:text-destructive"
                onClick={() => set("headers", form.headers.filter((_, i) => i !== idx))}
                aria-label={`Remove header ${h.key || `#${idx + 1}`}`}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => set("headers", [...form.headers, { key: "", value: "" }])}
          >
            <Plus className="h-3.5 w-3.5" /> Add header
          </Button>
        </div>
      </div>

      {/* Payload template */}
      <div className="mt-4">
        <label className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <input
            type="checkbox"
            checked={form.use_default_payload}
            onChange={(e) => set("use_default_payload", e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          Use full default payload (all event fields)
        </label>
        {!form.use_default_payload && (
          <div className="space-y-2">
            <textarea
              className="min-h-[160px] w-full rounded-md border border-input bg-transparent p-3 font-mono text-xs"
              placeholder={buildSampleTemplate(form.event_types[0] ?? "alert")}
              value={form.payload_template}
              onChange={(e) => set("payload_template", e.target.value)}
              spellCheck={false}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => set("payload_template", buildSampleTemplate(form.event_types[0] ?? "alert"))}
            >
              <Webhook className="h-3.5 w-3.5" /> Insert sample template
            </Button>
          </div>
        )}
      </div>

      {/* Event types */}
      <div className="mt-4">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Event triggers</p>
        <div className="flex flex-wrap gap-2">
          {EVENT_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => toggleEventType(t)}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                form.event_types.includes(t)
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Extra referenced secrets */}
      {referencedSecrets.filter((s) => !(authInfo?.secrets.includes(s))).length > 0 && (
        <div className="mt-4 rounded-lg border border-border/60 p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Secrets referenced in headers/template
          </p>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {referencedSecrets
              .filter((s) => !authInfo?.secrets.includes(s))
              .map((name) => (
                <div key={name}>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">{name}</label>
                  <Input
                    type="password"
                    placeholder={isEdit ? "•••••••• (unchanged)" : `enter ${name}`}
                    value={form.secrets[name] ?? ""}
                    onChange={(e) => set("secrets", { ...form.secrets, [name]: e.target.value })}
                  />
                </div>
              ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => set("enabled", e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          Enabled
        </label>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {isEdit ? "Save changes" : "Create connector"}
          </Button>
        </div>
      </div>
    </DashboardCard>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CustomIntegrationsPage() {
  const { capabilities, loading: roleLoading } = useAuthRole();
  const [integrations, setIntegrations] = useState<CustomIntegration[]>([]);
  const [schema, setSchema] = useState<CustomIntegrationSchema | null>(null);
  const [editing, setEditing] = useState<null | "new" | CustomIntegration>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; detail: string }>>({});

  const canManage = capabilities.can_manage_integrations;

  const load = useCallback(() => {
    fetchFromBackend<{ integrations?: CustomIntegration[]; total?: number }>(
      "/api/v1/integrations",
      { silent: true }
    ).then((d) => {
      if (d?.integrations) setIntegrations(d.integrations);
    });
    fetchFromBackend<CustomIntegrationSchema>("/api/v1/integrations/schema", { silent: true }).then(
      (d) => {
        if (d?.event_types) setSchema(d);
      }
    );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onDelete = async (name: string) => {
    const res = await fetchFromBackend<{ status?: string }>(
      `/api/v1/integrations/${name}`,
      { method: "DELETE", silent: true }
    );
    if (res?.status === "deleted") {
      toast("Connector removed", { description: name });
      load();
    }
  };

  const onTest = async (conn: CustomIntegration) => {
    const eventType = conn.event_types[0] ?? "alert";
    setTesting(conn.name);
    setTestResults((prev) => ({ ...prev, [conn.name]: { ok: true, detail: "testing…" } }));
    try {
      const raw = await fetch(`/api/backend/api/v1/integrations/${conn.name}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_type: eventType }),
      });
      const body = await raw.json().catch(() => ({}));
      // The backend wraps responses in the {"success","data","meta"} envelope —
      // unwrap so we read `status` from the inner payload, not the envelope.
      const unwrapped = (unwrapEnvelope(body) ?? {}) as {
        status?: string;
        detail?: string;
        message?: string;
      };
      if (raw.ok && unwrapped.status === "sent") {
        setTestResults((prev) => ({ ...prev, [conn.name]: { ok: true, detail: `sent ${eventType} sample` } }));
      } else {
        const detail = unwrapped.detail ?? unwrapped.message;
        setTestResults((prev) => ({
          ...prev,
          [conn.name]: { ok: false, detail: `failed: ${detail ?? raw.status}` },
        }));
      }
    } catch {
      setTestResults((prev) => ({ ...prev, [conn.name]: { ok: false, detail: "failed: network error" } }));
    } finally {
      setTesting(null);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Custom Outbound"
        description="Define connectors to any HTTP system — method, headers, auth, payload template, and event triggers."
        icon={<Webhook className="h-5 w-5" />}
        actions={
          <Button
            className="gap-2"
            disabled={!canManage}
            onClick={() => setEditing("new")}
          >
            <Plus className="h-4 w-4" /> New connector
          </Button>
        }
      />

      {!canManage && !roleLoading && (
        <DashboardCard title="Read-only">
          <p className="text-sm text-muted-foreground">
            Your role can view connectors but cannot create, edit, or delete them.
          </p>
        </DashboardCard>
      )}

      {editing !== null ? (
        <ConnectorFormCard
          schema={schema}
          editing={editing}
          onSaved={() => {
            setEditing(null);
            load();
          }}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <DashboardCard
          title="Connectors"
          description="Secrets are encrypted at rest and never displayed."
          badge={<Cable className="h-4 w-4 text-primary" />}
        >
          {integrations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No custom connectors yet. Create one to push alerts and events to any system.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-4">Name</th>
                    <th className="pb-2 pr-4">Method</th>
                    <th className="pb-2 pr-4">Target</th>
                    <th className="pb-2 pr-4">Events</th>
                    <th className="pb-2 pr-4">Auth</th>
                    <th className="pb-2 pr-4">Threshold</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {integrations.map((c) => {
                    const t = testResults[c.name];
                    return (
                      <tr key={c.id} className="border-b border-border/50">
                        <td className="py-2.5 pr-4 font-medium">{c.name}</td>
                        <td className="py-2.5 pr-4"><Badge variant="secondary" className="font-mono text-[10px]">{c.method}</Badge></td>
                        <td className="max-w-[220px] truncate py-2.5 pr-4 font-mono text-xs text-muted-foreground">{c.target_url}</td>
                        <td className="py-2.5 pr-4">
                          <div className="flex flex-wrap gap-1">
                            {c.event_types.map((et) => (
                              <Badge key={et} variant="outline" className="font-mono text-[10px]">{et}</Badge>
                            ))}
                          </div>
                        </td>
                        <td className="py-2.5 pr-4 text-xs text-muted-foreground">
                          {c.auth_type === "none" ? "—" : AUTH_LABELS[c.auth_type]}
                          {c.has_secrets ? " · keys" : ""}
                        </td>
                        <td className="py-2.5 pr-4 font-mono text-xs">{c.risk_threshold}</td>
                        <td className="py-2.5 pr-4">
                          <Badge variant={c.enabled ? "success" : "secondary"} className="text-[10px]">
                            {c.enabled ? "Enabled" : "Disabled"}
                          </Badge>
                        </td>
                        <td className="py-2.5 text-right">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1 text-xs"
                              onClick={() => onTest(c)}
                              disabled={testing === c.name || !canManage}
                            >
                              {testing === c.name ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
                              Test
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1 text-xs"
                              onClick={() => setEditing(c)}
                              disabled={!canManage}
                              aria-label={`Edit connector ${c.name}`}
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
                              onClick={() => onDelete(c.name)}
                              disabled={!canManage}
                              aria-label={`Delete connector ${c.name}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden />
                            </Button>
                          </div>
                          {t && (
                            <p className={`mt-1 flex items-center justify-end gap-1 text-[11px] ${t.ok ? "text-status-success" : "text-destructive"}`}>
                              {t.ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                              {t.detail}
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
      )}
    </div>
  );
}
