"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildIngestCurlSnippet } from "@/lib/ingestSnippet";
import { easeOut } from "@/lib/motionPresets";
import { LandingSectionHeader } from "./LandingSectionHeader";

const TABS = [
  { id: "curl", label: "curl" },
  { id: "node", label: "Node.js" },
] as const;

const NODE_SNIPPET = `import { ArtsaClient } from "@artsa/sdk";

const artsa = new ArtsaClient({ apiKey: process.env.ARTSA_API_KEY });

await artsa.ingest({
  session_id: "sess-demo-001",
  agent_id: "agent-support",
  tool_name: "read_file",
  arguments: { path: "/etc/passwd" },
});`;

export function LandingCodeShowcase() {
  const [tab, setTab] = useState<"curl" | "node">("curl");
  const [copied, setCopied] = useState(false);
  const code = tab === "curl" ? buildIngestCurlSnippet() : NODE_SNIPPET;

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
    <section className="px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <LandingSectionHeader
          badge="Developers"
          title="Wire agents in minutes"
          description="Point your stack at ingest. No runtime swap — telemetry flows into containment with a snippet or SDK."
          align="center"
          className="mx-auto max-w-2xl"
        />

        <motion.div
          className="landing-code-panel mx-auto mt-12 max-w-3xl overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55, ease: easeOut }}
        >
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
            <div className="flex gap-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`rounded-md px-3 py-1 text-xs font-mono transition-colors ${
                    tab === t.id
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground"
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
              className="h-8 gap-1.5 font-mono text-xs"
              onClick={() => void onCopy()}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <Copy className="h-3.5 w-3.5" aria-hidden />
              )}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <pre className="landing-code-panel__pre overflow-x-auto p-4 sm:p-6">
            <code className="font-mono text-[12px] leading-relaxed sm:text-[13px]">{code}</code>
          </pre>
        </motion.div>
      </div>
    </section>
  );
}
