"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, Github, PlugZap, Save, ShieldCheck } from "lucide-react";
import { fetchFromBackend } from "@/lib/api";
import { toast } from "@/lib/stores/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DashboardCard } from "@/components/shared/DashboardCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageStack } from "@/components/shared/PageStack";

type Installation = { id: string; github_installation_id: string; account_login?: string | null; status: string; last_webhook_at?: string | null };
type Repository = { id: string; full_name: string; private: boolean; archived: boolean; default_branch?: string | null };
type Inventory = { installations: Installation[]; repositories: Repository[] };
type Agent = { id: string; name: string; owner: string; purpose: string; allowed_tools: string[]; github_installations: string[]; github_repositories: string[]; enabled: boolean; last_seen: string };

function csv(value: string) { return value.split(",").map((item) => item.trim()).filter(Boolean); }

export function GitHubInventorySetup() {
  const [inventory, setInventory] = useState<Inventory>({ installations: [], repositories: [] });
  const [installationId, setInstallationId] = useState("");
  const [account, setAccount] = useState("");
  const refresh = useCallback(async () => {
    const result = await fetchFromBackend<Inventory>("/api/v1/github/inventory", { silent: true });
    if (result) setInventory(result);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const enroll = async () => {
    const result = await fetchFromBackend<Installation>("/api/v1/github/installations", { method: "POST", body: JSON.stringify({ github_installation_id: installationId, account_login: account || null }) });
    if (result) { toast("GitHub installation enrolled", { variant: "success" }); setInstallationId(""); setAccount(""); await refresh(); }
  };
  return <PageStack><PageHeader title="GitHub inventory" description="Enroll a GitHub App installation, then let signed webhooks project only repository metadata into ARTSA." icon={<Github className="h-5 w-5" />} />
    <div className="grid gap-6 xl:grid-cols-3"><DashboardCard title="Enroll installation" description="This creates a tenant binding. It does not store a token or claim the integration is live." className="xl:col-span-1"><div className="space-y-3"><Input aria-label="GitHub installation ID" placeholder="GitHub installation ID" value={installationId} onChange={(event) => setInstallationId(event.target.value)} /><Input aria-label="GitHub account login" placeholder="GitHub account login (optional)" value={account} onChange={(event) => setAccount(event.target.value)} /><Button className="w-full" onClick={() => void enroll()} disabled={!installationId.trim()}><PlugZap className="h-4 w-4" />Enroll</Button></div></DashboardCard>
      <DashboardCard title="Installation state" description="State advances only from a verified webhook." className="xl:col-span-2">{inventory.installations.length ? <div className="divide-y divide-border">{inventory.installations.map((row) => <div key={row.id} className="flex items-center justify-between gap-4 py-3 text-sm"><div><p className="font-medium">{row.account_login || "GitHub account pending"}</p><p className="font-mono text-xs text-muted-foreground">{row.github_installation_id}</p></div><span className="rounded border border-border bg-muted px-2 py-1 font-mono text-[11px]">{row.status}</span></div>)}</div> : <p className="text-sm text-muted-foreground">No GitHub App installation has been enrolled.</p>}</DashboardCard></div>
    <DashboardCard title="Repositories from signed webhook inventory" description="Repository rows are not inferred from an agent request or GitHub configuration."><div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="border-b border-border text-xs text-muted-foreground"><tr><th className="p-3">Repository</th><th className="p-3">Visibility</th><th className="p-3">Default branch</th><th className="p-3">State</th></tr></thead><tbody>{inventory.repositories.map((row) => <tr key={row.id} className="border-b border-border/60"><td className="p-3 font-mono text-xs">{row.full_name}</td><td className="p-3">{row.private ? "Private" : "Public"}</td><td className="p-3 font-mono text-xs">{row.default_branch || "—"}</td><td className="p-3">{row.archived ? "Archived" : "Active"}</td></tr>)}</tbody></table>{!inventory.repositories.length && <p className="p-5 text-sm text-muted-foreground">No repository metadata has arrived in a verified webhook yet.</p>}</div></DashboardCard>
  </PageStack>;
}

export function AgentRegistrySetup() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [form, setForm] = useState({ id: "", name: "", owner: "", purpose: "", tools: "github_create_issue", installations: "", repositories: "" });
  const refresh = useCallback(async () => { const result = await fetchFromBackend<Agent[]>("/api/v1/agents/registry/mcp", { silent: true }); if (Array.isArray(result)) setAgents(result); }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const save = async () => {
    const result = await fetchFromBackend<Agent>(`/api/v1/agents/registry/mcp/${encodeURIComponent(form.id)}`, { method: "PUT", body: JSON.stringify({ id: form.id, name: form.name, owner: form.owner, purpose: form.purpose, allowed_tools: csv(form.tools), github_installations: csv(form.installations), github_repositories: csv(form.repositories), enabled: true }) });
    if (result) { toast("Agent authority registered", { variant: "success" }); setForm({ id: "", name: "", owner: "", purpose: "", tools: "github_create_issue", installations: "", repositories: "" }); await refresh(); }
  };
  const set = (key: keyof typeof form, value: string) => setForm((previous) => ({ ...previous, [key]: value }));
  return <PageStack><PageHeader title="Managed agents" description="Every MCP session must belong to an explicit tenant-owned agent with a bounded GitHub authority." icon={<Bot className="h-5 w-5" />} />
    <div className="grid gap-6 xl:grid-cols-5"><DashboardCard title="Register agent authority" description="Comma-separated scopes are deny-by-default." className="xl:col-span-2"><div className="space-y-3"><Input aria-label="Agent ID" placeholder="Agent ID" value={form.id} onChange={(e) => set("id", e.target.value)} /><Input aria-label="Agent name" placeholder="Agent name" value={form.name} onChange={(e) => set("name", e.target.value)} /><Input aria-label="Owner" placeholder="Security owner" value={form.owner} onChange={(e) => set("owner", e.target.value)} /><Input aria-label="Purpose" placeholder="Declared purpose" value={form.purpose} onChange={(e) => set("purpose", e.target.value)} /><Input aria-label="Allowed tools" placeholder="Allowed tools" value={form.tools} onChange={(e) => set("tools", e.target.value)} /><Input aria-label="GitHub installation IDs" placeholder="GitHub installation IDs" value={form.installations} onChange={(e) => set("installations", e.target.value)} /><Input aria-label="Allowed repositories" placeholder="owner/repository" value={form.repositories} onChange={(e) => set("repositories", e.target.value)} /><Button className="w-full" onClick={() => void save()} disabled={!form.id || !form.name || !form.owner || !form.purpose || !form.installations || !form.repositories}><Save className="h-4 w-4" />Save authority</Button></div></DashboardCard>
      <DashboardCard title="Registered agent authority" description="Last seen updates only when a session is initialized." className="xl:col-span-3">{agents.length ? <div className="space-y-3">{agents.map((agent) => <div key={agent.id} className="rounded-lg border border-border p-4 text-sm"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{agent.name}</p><p className="font-mono text-xs text-muted-foreground">{agent.id}</p></div><span className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-700 dark:text-emerald-300"><ShieldCheck className="h-3 w-3" />{agent.enabled ? "Enabled" : "Disabled"}</span></div><p className="mt-3 text-muted-foreground">{agent.purpose}</p><div className="mt-3 grid gap-2 text-xs sm:grid-cols-2"><p><span className="text-muted-foreground">Owner:</span> {agent.owner}</p><p className="font-mono"><span className="text-muted-foreground">Tools:</span> {agent.allowed_tools.join(", ")}</p><p className="font-mono sm:col-span-2"><span className="text-muted-foreground">Repositories:</span> {agent.github_repositories.join(", ")}</p></div></div>)}</div> : <EmptyState icon={Bot} title="No managed agents registered" description="Register an agent before it can initialize an ARTSA MCP session." />}</DashboardCard></div>
  </PageStack>;
}
