"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Copy, Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { easeOut } from "@/lib/motionPresets";

const TABS = [
  { id: "python", label: "Python SDK" },
  { id: "node", label: "TypeScript / Node.js" },
  { id: "curl", label: "HTTP API" },
] as const;

const PYTHON_SNIPPET = `import os
import uuid
from artsa import ArtsaClient, ArtsaBlockedError

client = ArtsaClient(
    api_url=os.environ["ARTSA_API_URL"],
    api_key=os.environ["ARTSA_API_KEY"],
    fail_closed=True,
)

try:
    result = client.guard_tool_call(
        session_id=str(uuid.uuid4()),
        agent_id="support-agent",
        tool_name="search",
        arguments={"query": "refund policy"},
    )
    print(result)
except ArtsaBlockedError as error:
    print(f"Tool call blocked: {error}")`;

const NODE_SNIPPET = `import { randomUUID } from "node:crypto";
import { ArtsaClient, ArtsaBlockedError } from "artsa-guard";

const client = new ArtsaClient({
  apiUrl: process.env.ARTSA_API_URL,
  apiKey: process.env.ARTSA_API_KEY,
  failClosed: true,
});

try {
  const result = await client.guardToolCall({
    sessionId: randomUUID(),
    agentId: "support-agent",
    toolName: "search",
    arguments: { query: "refund policy" },
  });
  console.log(result);
} catch (error) {
  if (error instanceof ArtsaBlockedError) throw error;
  throw error;
}`;

const CURL_SNIPPET = `curl -X POST "$ARTSA_API_URL/api/v1/ingest" \\
  -H "Authorization: Bearer $ARTSA_API_KEY" \\
  -H "X-API-Key: $ARTSA_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "session_id": "<session-uuid>",
    "agent_id": "support-agent",
    "tool_name": "search",
    "arguments": { "query": "refund policy" }
  }'`;

export function LandingCodeShowcase() {
  const [tab, setTab] = useState<"python" | "node" | "curl">("python");
  const [copied, setCopied] = useState(false);

  const code =
    tab === "python" ? PYTHON_SNIPPET : tab === "node" ? NODE_SNIPPET : CURL_SNIPPET;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard denied */
    }
  };

  return (
    <section className="border-t border-slate-200/80 bg-slate-50/60 px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-mono font-medium text-blue-700 mb-3 shadow-xs">
            <Code2 className="h-3.5 w-3.5" />
            DEVELOPER FIRST INTEGRATION
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
            Integrate at the Tool Boundary
          </h2>
          <p className="mt-4 text-base text-slate-600 sm:text-lg">
            These examples use the repository&apos;s Python and TypeScript clients or the HTTP ingest endpoint.
            Set the API URL and credentials for your deployment, then keep tool execution behind the returned decision.
          </p>
        </div>

        <motion.div
          className="mx-auto mt-12 max-w-3xl overflow-hidden rounded-2xl border border-slate-800 bg-[#0F172A] shadow-2xl"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55, ease: easeOut }}
        >
          <div className="flex flex-wrap items-center justify-between border-b border-slate-800 bg-[#1E293B] px-4 py-2.5">
            <div className="flex gap-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-mono transition-colors ${
                    tab === t.id
                      ? "bg-blue-500/20 text-blue-400 border border-blue-500/30 font-semibold"
                      : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 font-mono text-xs text-slate-400 hover:text-white hover:bg-slate-800"
              onClick={() => void onCopy()}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
              ) : (
                <Copy className="h-3.5 w-3.5" aria-hidden />
              )}
              {copied ? "Copied" : "Copy snippet"}
            </Button>
          </div>
          <pre className="overflow-x-auto p-4 sm:p-6 text-slate-200">
            <code className="font-mono text-xs leading-relaxed sm:text-sm">{code}</code>
          </pre>
        </motion.div>
      </div>
    </section>
  );
}
