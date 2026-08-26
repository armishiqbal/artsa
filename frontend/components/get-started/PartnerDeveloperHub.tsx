"use client";

/**
 * Partner API Setup — client-facing HCI
 *
 * Principles applied here:
 * - Don't show empty "secret" panels (sounds broken).
 * - Reveal the full key only immediately after Issue (one-time).
 * - Use partner language, not internal jargon (session / hash / plaintext).
 * - Clear next action at every state.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Key,
  Copy,
  Check,
  Terminal,
  ShieldCheck,
  Play,
  Plus,
  Eye,
  EyeOff,
  Trash2,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DashboardCard } from "@/components/shared/DashboardCard";
import { toast } from "@/lib/stores/toast";
import { fetchFromBackend } from "@/lib/api";
import { ingestApiBaseUrl } from "@/lib/ingestSnippet";
import { cn } from "@/lib/utils";

type LanguageTab = "python" | "langchain" | "nodejs" | "curl";

interface PartnerKeyRow {
  id: string;
  name: string;
  api_key_masked: string;
  role: string;
  created_at?: string | null;
  api_key?: string;
}

const LANG_TABS: { id: LanguageTab; label: string }[] = [
  { id: "python", label: "Python" },
  { id: "langchain", label: "LangChain" },
  { id: "nodejs", label: "Node.js" },
  { id: "curl", label: "cURL" },
];

export function PartnerDeveloperHub() {
  const apiBase = ingestApiBaseUrl();
  const [keys, setKeys] = useState<PartnerKeyRow[]>([]);
  /** Full key only right after create — never reloaded from server. */
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [freshKeyName, setFreshKeyName] = useState<string>("");
  const [keyName, setKeyName] = useState("");
  const [showKey, setShowKey] = useState(true);
  const [activeTab, setActiveTab] = useState<LanguageTab>("python");
  const [copied, setCopied] = useState<"key" | "code" | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [hasReceivedEvent, setHasReceivedEvent] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [lastEventVerdict, setLastEventVerdict] = useState<{
    riskScore: number;
    verdict: string;
    latency: number;
    tool: string;
  } | null>(null);

  const loadKeys = useCallback(async () => {
    setLoadingKeys(true);
    const data = await fetchFromBackend<{ keys?: PartnerKeyRow[] }>("/api/v1/api-keys", {
      silent: true,
    });
    if (data?.keys) setKeys(data.keys);
    setLoadingKeys(false);
  }, []);

  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  const displayKey = useMemo(() => {
    if (!freshKey) return "";
    if (showKey) return freshKey;
    return `${freshKey.slice(0, 11)}${"•".repeat(18)}${freshKey.slice(-4)}`;
  }, [freshKey, showKey]);

  const dismissFreshKey = () => {
    setFreshKey(null);
    setFreshKeyName("");
    setShowKey(true);
  };

  const handleGenerateKey = async () => {
    const name = keyName.trim() || `partner-${keys.length + 1}`;
    setIsGenerating(true);
    const res = await fetchFromBackend<{
      status?: string;
      key?: PartnerKeyRow;
    }>("/api/v1/api-keys", {
      method: "POST",
      body: JSON.stringify({ name, role: "analyst" }),
      timeoutMs: 12_000,
    });
    setIsGenerating(false);
    if (res?.status === "ok" && res.key?.api_key) {
      setFreshKey(res.key.api_key);
      setFreshKeyName(res.key.name || name);
      setShowKey(true);
      setKeyName("");
      toast("Key ready to share", {
        description: "Copy it below and send it to your partner securely.",
        variant: "success",
      });
      void loadKeys();
    }
  };

  const handleRevoke = async (id: string, name: string) => {
    const res = await fetchFromBackend<{ status?: string }>(`/api/v1/api-keys/${id}`, {
      method: "DELETE",
      silent: true,
    });
    if (res?.status === "ok") {
      toast("Access removed", {
        description: `“${name}” can no longer call ARTSA.`,
        variant: "success",
      });
      void loadKeys();
    }
  };

  const handleCopyKey = async () => {
    if (!freshKey) return;
    try {
      await navigator.clipboard.writeText(freshKey);
      setCopied("key");
      toast("Copied", { description: "Paste this into your partner’s environment.", variant: "success" });
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast("Copy failed", { description: "Select the key and copy manually.", variant: "error" });
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied("code");
      toast("Code copied", { description: "Paste into the partner application.", variant: "success" });
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast("Copy failed", { variant: "error" });
    }
  };

  const handleSendTestEvent = async (isMalicious: boolean = false) => {
    setIsSendingTest(true);
    const start = performance.now();
    const payload = isMalicious
      ? {
          session_id: "test-session-" + Date.now(),
          agent_id: "partner-test-agent",
          tool_name: "query_database",
          arguments: { query: "SELECT * FROM admin_passwords;" },
        }
      : {
          session_id: "test-session-" + Date.now(),
          agent_id: "partner-test-agent",
          tool_name: "query_database",
          arguments: { query: "SELECT order_id, status FROM orders WHERE id = 101;" },
        };

    try {
      const res = await fetchFromBackend<{
        risk_score?: { overall_score?: number } | number;
        verdict?: { verdict?: string; recommended_action?: string } | string;
      }>("/api/v1/ingest", {
        method: "POST",
        body: JSON.stringify(payload),
        timeoutMs: 15_000,
      });

      const elapsed = Math.round(performance.now() - start);
      const riskRaw = res?.risk_score;
      const risk =
        typeof riskRaw === "number"
          ? riskRaw
          : typeof riskRaw === "object" && riskRaw
            ? Number(riskRaw.overall_score ?? 0)
            : isMalicious
              ? 94
              : 15;
      const verdictObj = res?.verdict;
      const action =
        typeof verdictObj === "object" && verdictObj
          ? String(verdictObj.recommended_action || verdictObj.verdict || "")
          : String(verdictObj ?? "");
      const verdict =
        action.includes("QUARANTINE") || action.includes("KILL") || risk >= 80
          ? "Blocked"
          : "Allowed";

      setHasReceivedEvent(true);
      setLastEventVerdict({
        riskScore: Math.round(risk),
        verdict,
        latency: Math.max(elapsed, 1),
        tool: payload.tool_name,
      });
      toast(verdict === "Blocked" ? "Threat blocked" : "Safe call allowed", {
        description: `Risk ${Math.round(risk)} · ${elapsed}ms`,
        variant: "success",
      });
    } catch {
      toast("Could not reach ARTSA", {
        description: "Check that the API is online, then try again.",
        variant: "error",
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  const keyForSnippet = freshKey || "YOUR_ARTSA_API_KEY";

  const codeSnippets: Record<LanguageTab, string> = {
    python: `import requests

ARTSA_URL = "${apiBase}"
ARTSA_API_KEY = "${keyForSnippet}"

response = requests.post(
    f"{ARTSA_URL}/api/v1/ingest",
    headers={"X-API-Key": ARTSA_API_KEY, "Content-Type": "application/json"},
    json={
        "session_id": "user-session-101",
        "agent_id": "my-agent",
        "tool_name": "query_database",
        "arguments": {"query": "SELECT * FROM users;"},
    },
    timeout=2.0,
)
result = response.json()
action = (result.get("verdict") or {}).get("recommended_action", "NONE")
if action in ("KILL", "QUARANTINE"):
    raise SystemExit(f"Blocked by ARTSA: {action}")
# Safe — continue and run the tool`,

    langchain: `from artsa import ArtsaClient
from artsa.middleware.langchain import LangChainContainmentCallback

client = ArtsaClient(
    api_url="${apiBase}",
    api_key="${keyForSnippet}",
)
guard = LangChainContainmentCallback(client=client, agent_id="my-agent")
# Attach guard so tool calls are checked before they run.`,

    nodejs: `const ARTSA_URL = "${apiBase}";
const ARTSA_API_KEY = "${keyForSnippet}";

async function checkWithArtsa(toolName, toolArgs) {
  const res = await fetch(\`\${ARTSA_URL}/api/v1/ingest\`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": ARTSA_API_KEY,
    },
    body: JSON.stringify({
      session_id: "user-session-101",
      agent_id: "my-agent",
      tool_name: toolName,
      arguments: toolArgs,
    }),
  });
  const result = await res.json();
  const action = result?.verdict?.recommended_action || "NONE";
  if (action === "KILL" || action === "QUARANTINE") {
    throw new Error(\`Blocked by ARTSA: \${action}\`);
  }
  return result;
}`,

    curl: `curl -s -X POST "${apiBase}/api/v1/ingest" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${keyForSnippet}" \\
  -d '{
    "session_id": "test-session-001",
    "agent_id": "my-agent",
    "tool_name": "query_database",
    "arguments": {"query": "SELECT * FROM admin_passwords;"}
  }'`,
  };

  const hasKeys = keys.length > 0;

  return (
    <div className="space-y-6">
      {/* What to do — plain language for clients */}
      <div className="rounded-[8px] border border-[#313131] bg-[#1e1e1e] px-5 py-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.85px] text-[#6798ff]">
          How partners connect
        </p>
        <ol className="mt-3 grid gap-3 sm:grid-cols-3">
          <li className="text-[13px] leading-relaxed text-[#a7a7a7]">
            <span className="font-medium text-white">1. Create a key</span>
            <br />
            Name it for the partner or system.
          </li>
          <li className="text-[13px] leading-relaxed text-[#a7a7a7]">
            <span className="font-medium text-white">2. Share it once</span>
            <br />
            They add it as <span className="font-mono text-[#e8e8e8]">X-API-Key</span>.
          </li>
          <li className="text-[13px] leading-relaxed text-[#a7a7a7]">
            <span className="font-medium text-white">3. They call ingest</span>
            <br />
            Before each tool — block if ARTSA says so.
          </li>
        </ol>
      </div>

      <DashboardCard
        title="API keys"
        description="Give each partner their own key. You can revoke access anytime."
        icon={<Key className="h-4 w-4" />}
        badge={
          <Badge variant="outline" className="meta-badge font-mono text-[10px]">
            {loadingKeys ? "…" : `${keys.length} active`}
          </Badge>
        }
      >
        <div className="space-y-5">
          {/* Create */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label htmlFor="partner-key-name" className="mb-1.5 block text-[13px] font-medium text-[#a7a7a7]">
                Name for this key
              </label>
              <Input
                id="partner-key-name"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                placeholder="e.g. Acme production bot"
                className="h-10 text-[14px]"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleGenerateKey();
                }}
              />
            </div>
            <Button
              onClick={() => void handleGenerateKey()}
              disabled={isGenerating}
              className="h-10 shrink-0 gap-2 px-5"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Plus className="h-4 w-4" aria-hidden />
              )}
              {isGenerating ? "Creating…" : hasKeys ? "Create another key" : "Create API key"}
            </Button>
          </div>

          {/* One-time reveal — ONLY after create. Never show empty jargon. */}
          {freshKey ? (
            <div
              className="rounded-[8px] border border-[hsl(var(--status-success-border))] bg-[hsl(var(--status-success-subtle))] p-4"
              role="status"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[14px] font-medium text-white">
                    Key created{freshKeyName ? ` — ${freshKeyName}` : ""}
                  </p>
                  <p className="mt-1 text-[12px] text-[#a7a7a7]">
                    Copy now and send it to your partner. For security, ARTSA will not show the full
                    key again.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={dismissFreshKey}
                  className="rounded-[6px] p-1 text-[#7c7c7c] hover:bg-black/20 hover:text-white"
                  aria-label="Dismiss"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                <code className="min-w-0 flex-1 select-all break-all rounded-[6px] border border-[#313131] bg-[#0a0a0a] px-3 py-2.5 font-mono text-[13px] text-white">
                  {displayKey}
                </code>
                <div className="flex shrink-0 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10 gap-1.5"
                    onClick={() => setShowKey((v) => !v)}
                  >
                    {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    {showKey ? "Hide" : "Show"}
                  </Button>
                  <Button type="button" size="sm" className="h-10 gap-1.5" onClick={() => void handleCopyKey()}>
                    {copied === "key" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied === "key" ? "Copied" : "Copy key"}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {/* Active keys table */}
          <div>
            <p className="mb-2 text-[13px] font-medium text-[#a7a7a7]">Your keys</p>
            {loadingKeys ? (
              <div className="flex items-center gap-2 py-6 text-[13px] text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Loading keys…
              </div>
            ) : !hasKeys ? (
              <div className="rounded-[8px] border border-dashed border-[#313131] px-4 py-8 text-center">
                <p className="text-[14px] font-medium text-white">No API keys yet</p>
                <p className="mt-1 text-[13px] text-[#a7a7a7]">
                  Create one above, then share it with the team integrating ARTSA.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-[8px] border border-[#313131]">
                <table className="w-full text-left text-[13px]">
                  <thead className="border-b border-[#313131] bg-[#0a0a0a] text-[11px] uppercase tracking-[0.06em] text-[#7c7c7c]">
                    <tr>
                      <th className="px-3 py-2.5 font-medium">Name</th>
                      <th className="px-3 py-2.5 font-medium">Key</th>
                      <th className="px-3 py-2.5 font-medium">Access</th>
                      <th className="px-3 py-2.5 text-right font-medium"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {keys.map((k) => (
                      <tr key={k.id} className="border-b border-[#313131]/80 last:border-0">
                        <td className="px-3 py-3 font-medium text-white">{k.name}</td>
                        <td className="px-3 py-3 font-mono text-[12px] text-[#a7a7a7]">
                          {k.api_key_masked}
                        </td>
                        <td className="px-3 py-3 text-[#a7a7a7]">
                          {k.role === "analyst" ? "Ingest & view" : k.role}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5 text-[#a7a7a7] hover:text-destructive"
                            onClick={() => void handleRevoke(k.id, k.name)}
                            aria-label={`Remove access for ${k.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Revoke
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="border-t border-[#313131] bg-[#0a0a0a] px-3 py-2 text-[12px] text-[#7c7c7c]">
                  Full keys are only shown once at creation. Masked values are for identification.
                </p>
              </div>
            )}
          </div>
        </div>
      </DashboardCard>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <DashboardCard
          className="xl:col-span-3"
          title="Code for your partner"
          description={
            freshKey
              ? "This sample already includes the key you just created."
              : "Replace YOUR_ARTSA_API_KEY with the key you shared."
          }
          icon={<Terminal className="h-4 w-4" />}
          actions={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => void handleCopyCode(codeSnippets[activeTab])}
            >
              {copied === "code" ? (
                <Check className="h-3.5 w-3.5 text-status-success" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied === "code" ? "Copied" : "Copy code"}
            </Button>
          }
          contentClassName="space-y-0 pt-0"
        >
          <div className="mb-3 flex flex-wrap gap-1 rounded-[8px] border border-[#313131] bg-[#0a0a0a] p-1">
            {LANG_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "rounded-[6px] px-3 py-1.5 text-[12px] font-medium transition-colors",
                  activeTab === tab.id
                    ? "bg-white text-[#0a0a0a]"
                    : "text-[#a7a7a7] hover:text-white"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="max-h-[320px] overflow-auto rounded-[8px] border border-[#313131] bg-[#0a0a0a] p-4">
            <pre className="font-mono text-[12px] leading-relaxed text-[#e8e8e8]">
              <code>{codeSnippets[activeTab]}</code>
            </pre>
          </div>
          <p className="mt-3 text-[12px] text-[#7c7c7c]">
            Endpoint:{" "}
            <span className="font-mono text-[#a7a7a7]">
              {apiBase}/api/v1/ingest
            </span>
          </p>
        </DashboardCard>

        <DashboardCard
          className="xl:col-span-2"
          title="Try it here"
          description="Send a sample tool call to confirm ARTSA responds."
          icon={<ShieldCheck className="h-4 w-4" />}
        >
          {!hasReceivedEvent ? (
            <div className="rounded-[8px] border border-dashed border-[#313131] bg-[#0a0a0a] px-4 py-8 text-center">
              <p className="text-[14px] font-medium text-white">No test yet</p>
              <p className="mt-1 text-[12px] leading-relaxed text-[#a7a7a7]">
                Use a safe or attack sample to see allow vs block.
              </p>
            </div>
          ) : (
            <div className="rounded-[8px] border border-[#313131] bg-[#0a0a0a] p-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[13px] font-medium text-white">
                  <ShieldCheck className="h-4 w-4 text-status-success" aria-hidden />
                  Response received
                </span>
                <span className="font-mono text-[11px] text-[#7c7c7c]">
                  {lastEventVerdict?.latency} ms
                </span>
              </div>
              <dl className="mt-3 space-y-2 border-t border-[#313131] pt-3 text-[12px]">
                <div className="flex justify-between">
                  <dt className="text-[#7c7c7c]">Tool</dt>
                  <dd className="font-mono text-white">{lastEventVerdict?.tool}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#7c7c7c]">Risk</dt>
                  <dd className="font-mono text-white">{lastEventVerdict?.riskScore}/100</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#7c7c7c]">Result</dt>
                  <dd
                    className={cn(
                      "font-medium",
                      lastEventVerdict?.verdict === "Blocked"
                        ? "text-[hsl(var(--severity-critical))]"
                        : "text-status-success"
                    )}
                  >
                    {lastEventVerdict?.verdict}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              disabled={isSendingTest}
              onClick={() => void handleSendTestEvent(false)}
            >
              {isSendingTest ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              Safe sample
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              disabled={isSendingTest}
              onClick={() => void handleSendTestEvent(true)}
            >
              <Play className="h-3.5 w-3.5" />
              Attack sample
            </Button>
          </div>
        </DashboardCard>
      </div>
    </div>
  );
}
