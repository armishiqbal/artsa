"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildIngestCurlSnippet, copyIngestCurl } from "@/lib/ingestSnippet";
import { INGEST_UI } from "@/lib/getStartedLabels";
import { cn } from "@/lib/utils";

export function CopyIngestCurlButton({
  size = "sm",
  variant = "outline",
  className,
  label,
  showIcon = true,
}: {
  size?: "sm" | "default" | "lg";
  variant?: "default" | "outline" | "ghost";
  className?: string;
  label?: string;
  showIcon?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    const ok = await copyIngestCurl();
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={cn("gap-1.5", className)}
      onClick={() => void onCopy()}
    >
      {showIcon && (copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />)}
      {copied ? INGEST_UI.copied : label ?? INGEST_UI.copyCurl}
    </Button>
  );
}

export function IngestSnippetPanel({
  compact,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const snippet = buildIngestCurlSnippet();

  const copy = async () => {
    const ok = await copyIngestCurl();
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  if (compact) {
    return (
      <div className={cn("rounded-lg border border-border bg-muted/15 p-3 space-y-2", className)}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium">{INGEST_UI.wireTitle}</p>
          <CopyIngestCurlButton size="sm" variant="ghost" className="h-7 text-xs" />
        </div>
        <p className="text-[10px] text-muted-foreground">{INGEST_UI.wireHint}</p>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border border-border bg-card p-4 shadow-card sm:p-5", className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{INGEST_UI.wireTitle}</h2>
        <Button type="button" size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => void copy()}>
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? INGEST_UI.copied : INGEST_UI.copyCurl}
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{INGEST_UI.wireHint}</p>
      <pre className="mt-3 overflow-x-auto rounded-md border border-border bg-[hsl(var(--foreground)/0.03)] p-3 font-mono text-[10px] leading-relaxed">
        {snippet}
      </pre>
    </div>
  );
}
