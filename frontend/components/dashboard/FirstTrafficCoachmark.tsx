"use client";

import Link from "next/link";
import { Activity, Loader2, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyIngestCurlButton } from "@/components/shared/IngestSnippetPanel";
import { COACHMARK_UI, COMMAND_CENTER_UI } from "@/lib/getStartedLabels";

export function FirstTrafficCoachmark({
  onTestIngest,
  testLoading,
  onDismiss,
}: {
  onTestIngest: () => void;
  testLoading: boolean;
  onDismiss: () => void;
}) {
  return (
    <div
      className="rounded-xl border border-foreground/20 bg-muted/30 p-4 sm:p-5 shadow-card animate-panel-in"
      role="status"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3 min-w-0">
          <Activity className="mt-0.5 h-5 w-5 shrink-0 text-status-success" aria-hidden />
          <div>
            <p className="text-sm font-semibold">{COACHMARK_UI.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{COACHMARK_UI.description}</p>
          </div>
        </div>
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={onDismiss} aria-label="Dismiss">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" onClick={onTestIngest} disabled={testLoading} className="gap-1.5">
          {testLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {COMMAND_CENTER_UI.testIngestNow}
        </Button>
        <CopyIngestCurlButton size="sm" variant="outline" />
        <Button asChild size="sm" variant="outline">
          <Link href="/get-started">{COMMAND_CENTER_UI.getStarted}</Link>
        </Button>
      </div>
    </div>
  );
}
