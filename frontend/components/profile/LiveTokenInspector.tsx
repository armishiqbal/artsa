"use client";

import { useEffect, useState, useMemo } from "react";
import {
  KeyRound,
  Copy,
  Check,
  Eye,
  EyeOff,
  Terminal,
  Clock,
  Cpu,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { DashboardCard } from "@/components/shared/DashboardCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/stores/auth";
import { toast } from "@/lib/stores/toast";
import { cn } from "@/lib/utils";

type SdkTab = "curl" | "python" | "typescript";

export function LiveTokenInspector() {
  const bearerToken = useAuthStore((s) => s.bearerToken);
  const apiKey = useAuthStore((s) => s.apiKey);
  const [showSecret, setShowSecret] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [sdkTab, setSdkTab] = useState<SdkTab>("curl");
  const [timeLeft, setTimeLeft] = useState<string>("--:--:--");

  const activeCredential = bearerToken || apiKey || "NO_ACTIVE_CREDENTIAL";
  const isBearer = Boolean(bearerToken);

  // Decode JWT payload safely client-side
  const decodedJwt = useMemo(() => {
    if (!bearerToken) return null;
    try {
      const parts = bearerToken.split(".");
      if (parts.length < 2) return null;
      const payload = JSON.parse(atob(parts[1]));
      return payload as {
        sub?: string;
        email?: string;
        role?: string;
        exp?: number;
        iat?: number;
        display_name?: string;
      };
    } catch {
      return null;
    }
  }, [bearerToken]);

  // Live ticking countdown for token expiry
  useEffect(() => {
    if (!decodedJwt?.exp) return;
    const interval = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      const diff = (decodedJwt.exp || 0) - now;
      if (diff <= 0) {
        setTimeLeft("Expired");
      } else {
        const hours = Math.floor(diff / 3600);
        const mins = Math.floor((diff % 3600) / 60);
        const secs = diff % 60;
        setTimeLeft(
          `${String(hours).padStart(2, "0")}h ${String(mins).padStart(2, "0")}m ${String(secs).padStart(2, "0")}s`
        );
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [decodedJwt]);

  const maskString = (str: string) => {
    if (str.length <= 16) return "••••••••••••••••";
    return `${str.slice(0, 8)}••••••••••••••••${str.slice(-6)}`;
  };

  const copyToClipboard = async (text: string, isCode = false) => {
    try {
      await navigator.clipboard.writeText(text);
      if (isCode) {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
        toast("SDK snippet copied", { description: "Paste directly into your terminal or script." });
      } else {
        setCopiedToken(true);
        setTimeout(() => setCopiedToken(false), 2000);
        toast("Key copied", { description: "Handle securely and do not share in public repositories." });
      }
    } catch {
      toast("Copy failed", { variant: "error" });
    }
  };

  const codeSnippets: Record<SdkTab, string> = {
    curl: isBearer
      ? `curl -X POST http://localhost:8000/api/v1/ingest \\
  -H "Authorization: Bearer ${showSecret ? bearerToken : "<YOUR_JWT_TOKEN>"}" \\
  -H "Content-Type: application/json" \\
  -d '{"session_id": "session-001", "agent_id": "agent-guard-01", "tool_name": "bash", "arguments": {"command": "echo test"}}'`
      : `curl -X POST http://localhost:8000/api/v1/ingest \\
  -H "X-API-Key: ${showSecret ? apiKey : "<YOUR_API_KEY>"}" \\
  -H "Content-Type: application/json" \\
  -d '{"session_id": "session-001", "agent_id": "agent-guard-01", "tool_name": "bash", "arguments": {"command": "echo test"}}'`,

    python: isBearer
      ? `import httpx

API_URL = "http://localhost:8000/api/v1"
TOKEN = "${showSecret ? bearerToken : "<YOUR_JWT_TOKEN>"}"

client = httpx.Client(headers={"Authorization": f"Bearer {TOKEN}"})
response = client.post(f"{API_URL}/ingest", json={
    "session_id": "agent-run-101",
    "agent_id": "my-agent",
    "tool_name": "db_query",
    "arguments": {"query": "SELECT * FROM users"}
})
print("Containment Verdict:", response.json())`
      : `import httpx

API_URL = "http://localhost:8000/api/v1"
API_KEY = "${showSecret ? apiKey : "<YOUR_API_KEY>"}"

client = httpx.Client(headers={"X-API-Key": API_KEY})
response = client.post(f"{API_URL}/ingest", json={
    "session_id": "agent-run-101",
    "agent_id": "my-agent",
    "tool_name": "db_query",
    "arguments": {"query": "SELECT * FROM users"}
})
print("Containment Verdict:", response.json())`,

    typescript: isBearer
      ? `import axios from "axios";

const client = axios.create({
  baseURL: "http://localhost:8000/api/v1",
  headers: {
    Authorization: "Bearer ${showSecret ? bearerToken : "<YOUR_JWT_TOKEN>"}",
  },
});

async function sendTelemetry() {
  const res = await client.post("/ingest", {
    session_id: "agent-run-101",
    agent_id: "security-auditor-01",
    tool_name: "file_read",
    arguments: { path: "/var/log/syslog" },
  });
  console.log("Verdict:", res.data);
}`
      : `import axios from "axios";

const client = axios.create({
  baseURL: "http://localhost:8000/api/v1",
  headers: {
    "X-API-Key": "${showSecret ? apiKey : "<YOUR_API_KEY>"}",
  },
});

async function sendTelemetry() {
  const res = await client.post("/ingest", {
    session_id: "agent-run-101",
    agent_id: "security-auditor-01",
    tool_name: "file_read",
    arguments: { path: "/var/log/syslog" },
  });
  console.log("Verdict:", res.data);
}`,
  };

  return (
    <div role="tabpanel" id="panel-credentials" aria-labelledby="tab-credentials" className="space-y-6">
      {/* Active Key / Token Card */}
      <DashboardCard
        title="Active API Key & Session Token"
        description="Credentials used to authenticate scripts, agents, and SDK clients."
        icon={<KeyRound className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">
              {isBearer ? "Session Bearer Token (JWT)" : "Role API Key"}
            </span>
            <Badge variant="outline" className="font-mono text-[10px]">
              {isBearer ? "HS256 Signed" : "Static Key"}
            </Badge>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-border/80 bg-muted/40 p-3 shadow-inner">
            <span className="flex-1 font-mono text-xs text-foreground select-all break-all">
              {showSecret ? activeCredential : maskString(activeCredential)}
            </span>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowSecret(!showSecret)}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              aria-label={showSecret ? "Mask key" : "Reveal key"}
              title={showSecret ? "Mask key" : "Reveal key"}
            >
              {showSecret ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            </Button>

            <Button
              size="sm"
              variant="secondary"
              onClick={() => copyToClipboard(activeCredential)}
              className="h-8 gap-1.5 px-3 text-xs font-semibold shadow-xs"
              aria-label="Copy key to clipboard"
            >
              {copiedToken ? (
                <>
                  <Check className="h-3.5 w-3.5 text-status-success" aria-hidden="true" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  Copy Key
                </>
              )}
            </Button>
          </div>

          {/* Decoded Claims & Expiration Countdown */}
          {decodedJwt && (
            <div className="rounded-xl border border-border/80 bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  Token Session Details
                </span>
                <span className="font-mono text-xs text-status-success font-semibold flex items-center gap-1">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  Expires in {timeLeft}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5">
                  <span className="text-[11px] font-mono text-muted-foreground uppercase">Subject</span>
                  <p className="font-mono text-xs text-foreground truncate mt-0.5">
                    {decodedJwt.email || decodedJwt.sub || "—"}
                  </p>
                </div>

                <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5">
                  <span className="text-[11px] font-mono text-muted-foreground uppercase">Role</span>
                  <p className="font-mono text-xs text-foreground uppercase mt-0.5">
                    {decodedJwt.role || "—"}
                  </p>
                </div>

                <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5">
                  <span className="text-[11px] font-mono text-muted-foreground uppercase">Rotation TTL</span>
                  <p className="font-mono text-xs text-foreground mt-0.5">
                    8-Hour Rotation
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-start gap-2.5 rounded-lg border border-border/80 bg-muted/20 p-3 text-xs text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <p>
              Keep your keys secret. Do not commit tokens or keys to public Git repositories.
            </p>
          </div>
        </div>
      </DashboardCard>

      {/* Multi-Language Developer Snippets */}
      <DashboardCard
        title="Developer & SDK Integration"
        description="Ready-to-use code examples for connecting your AI agents."
        icon={<Terminal className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={() => copyToClipboard(codeSnippets[sdkTab], true)}
            className="gap-1.5 text-xs shadow-xs"
            aria-label="Copy SDK snippet"
          >
            {copiedCode ? (
              <>
                <Check className="h-3.5 w-3.5 text-status-success" aria-hidden="true" />
                Copied Snippet
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                Copy Code
              </>
            )}
          </Button>
        }
      >
        <div className="space-y-3">
          {/* SDK Language Tabs */}
          <div className="flex items-center gap-1.5 border-b border-border/70 pb-2" role="tablist" aria-label="SDK code snippet languages">
            {(["curl", "python", "typescript"] as SdkTab[]).map((tab) => (
              <button
                key={tab}
                role="tab"
                aria-selected={sdkTab === tab}
                type="button"
                onClick={() => setSdkTab(tab)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-mono font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/15",
                  sdkTab === tab
                    ? "border-foreground bg-muted font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent"
                )}
              >
                {tab === "curl" ? "cURL" : tab === "python" ? "Python (httpx)" : "TypeScript / Node"}
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-border/80 bg-background/95 p-4 font-mono text-xs text-foreground overflow-x-auto shadow-inner">
            <pre className="whitespace-pre">{codeSnippets[sdkTab]}</pre>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
            <span>Server endpoint: <code>http://localhost:8000/api/v1</code></span>
            <a
              href="http://localhost:8000/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-foreground hover:underline font-semibold"
            >
              Interactive API Docs <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          </div>
        </div>
      </DashboardCard>
    </div>
  );
}
