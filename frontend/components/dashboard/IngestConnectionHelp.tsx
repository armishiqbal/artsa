"use client";

import { useState } from "react";
import { CheckCircle2, Copy, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyIngestCurlButton } from "@/components/shared/IngestSnippetPanel";
import { COMMAND_CENTER_UI } from "@/lib/getStartedLabels";
import { ingestApiBaseUrl } from "@/lib/ingestSnippet";
import { cn } from "@/lib/utils";

export function IngestConnectionHelp({
  wsConnected,
  hasEvents,
  ingestKeyConfigured,
  onTestIngest,
  testLoading,
  testMessage,
  testOk,
}: {
  wsConnected: boolean;
  hasEvents: boolean;
  ingestKeyConfigured: boolean;
  onTestIngest: () => void;
  testLoading: boolean;
  testMessage: string | null;
  testOk: boolean | null;
}) {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const ingestUrl = `${ingestApiBaseUrl()}/api/v1/ingest`;

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(ingestUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="rounded-lg border border-border bg-muted/15 p-4 space-y-3">
      <p className="text-sm font-medium">{COMMAND_CENTER_UI.ingestEndpointTitle}</p>
      <p className="text-xs text-muted-foreground">{COMMAND_CENTER_UI.ingestEndpointHint}</p>

      <div className="flex flex-wrap items-center gap-2">
        <code className="flex-1 rounded-md border border-border bg-card px-3 py-2 font-mono text-[11px] break-all">
          POST {ingestUrl}
        </code>
        <Button type="button" size="sm" variant="outline" onClick={() => void copyUrl()}>
          <Copy className="h-3.5 w-3.5" />
          {copiedUrl ? "Copied URL" : "Copy URL"}
        </Button>
        <CopyIngestCurlButton />
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-2 py-1",
            wsConnected && hasEvents
              ? "border-status-success/30 bg-status-success/5"
              : "border-border bg-card text-muted-foreground"
          )}
        >
          {wsConnected && hasEvents ? COMMAND_CENTER_UI.liveFeedActive : COMMAND_CENTER_UI.liveFeedNoEvents}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-2 py-1",
            ingestKeyConfigured
              ? "border-status-success/30 bg-status-success/5"
              : "border-status-warning/30 bg-status-warning/5"
          )}
        >
          {ingestKeyConfigured ? (
            <CheckCircle2 className="h-3 w-3" />
          ) : (
            <XCircle className="h-3 w-3" />
          )}
          {ingestKeyConfigured ? COMMAND_CENTER_UI.ingestKeyOk : COMMAND_CENTER_UI.ingestKeyMissing}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={onTestIngest} disabled={testLoading}>
          {testLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {COMMAND_CENTER_UI.testIngestNow}
        </Button>
        {testMessage && (
          <span
            className={cn(
              "text-xs",
              testOk ? "text-status-success" : "text-destructive"
            )}
          >
            {testMessage}
          </span>
        )}
      </div>
    </div>
  );
}
