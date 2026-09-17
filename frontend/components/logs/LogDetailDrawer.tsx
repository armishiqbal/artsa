"use client";

import { useState } from "react";
import { X, Copy, Check, ShieldAlert, Clock, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/stores/toast";
import type { LogRecord } from "@/lib/logsTypes";
import { cn } from "@/lib/utils";

interface LogDetailDrawerProps {
  row: LogRecord | null;
  onClose: () => void;
}

export function LogDetailDrawer({ row, onClose }: LogDetailDrawerProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "payload" | "raw">("overview");

  if (!row) return null;

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(label);
      toast(`Copied ${label} to clipboard`, { variant: "success" });
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast("Failed to copy to clipboard", { variant: "error" });
    }
  };

  const hasThreat = row.threatsDetected.some((t) => t !== "No detections");

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-background/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-border bg-card shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-border/80 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg",
                hasThreat ? "bg-rose-500/10 text-rose-600" : "bg-emerald-500/10 text-emerald-600"
              )}
            >
              <ShieldAlert className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-mono text-sm font-semibold text-foreground">
                  {row.requestId}
                </h3>
                <button
                  type="button"
                  onClick={() => copyToClipboard(row.requestId, "Request ID")}
                  className="text-muted-foreground hover:text-foreground"
                  title="Copy Request ID"
                >
                  {copiedField === "Request ID" ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">{row.timestamp}</p>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-border/60 px-5 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={cn(
              "border-b-2 py-2.5 px-3 font-medium transition-colors",
              activeTab === "overview"
                ? "border-primary text-foreground font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("payload")}
            className={cn(
              "border-b-2 py-2.5 px-3 font-medium transition-colors",
              activeTab === "payload"
                ? "border-primary text-foreground font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Content & Policy
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("raw")}
            className={cn(
              "border-b-2 py-2.5 px-3 font-medium transition-colors",
              activeTab === "raw"
                ? "border-primary text-foreground font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Raw JSON
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {activeTab === "overview" && (
            <>
              {/* Threat Status Card */}
              <div
                className={cn(
                  "rounded-xl border p-4",
                  hasThreat
                    ? "border-rose-200 bg-rose-50/50 dark:border-rose-900/50 dark:bg-rose-950/20"
                    : "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20"
                )}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Detection Summary
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {row.threatsDetected.map((t, i) => (
                    <span
                      key={i}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-xs font-semibold",
                        t === "No detections"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200"
                          : "bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200"
                      )}
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Origin source: <span className="font-medium text-foreground">{row.threatSource}</span> · Mode:{" "}
                  <span className="font-medium text-foreground">{row.projectMode}</span>
                </p>
              </div>

              {/* Execution Telemetry Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span className="text-[11px]">Latency</span>
                  </div>
                  <p className="mt-1 font-mono text-base font-semibold text-foreground">
                    {row.latencyMs} ms
                  </p>
                </div>

                <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Globe className="h-3.5 w-3.5" />
                    <span className="text-[11px]">Region</span>
                  </div>
                  <p className="mt-1 font-mono text-base font-semibold text-foreground">
                    {row.processingRegion}
                  </p>
                </div>
              </div>

              {/* Attributes Table */}
              <div className="rounded-xl border border-border/80 bg-card overflow-hidden">
                <div className="border-b border-border/60 bg-muted/30 px-3.5 py-2 font-semibold text-muted-foreground text-[11px]">
                  Request Context
                </div>
                <div className="divide-y divide-border/50 text-xs">
                  <div className="flex justify-between px-3.5 py-2">
                    <span className="text-muted-foreground">Project</span>
                    <span className="font-medium text-foreground">{row.project}</span>
                  </div>
                  <div className="flex justify-between px-3.5 py-2">
                    <span className="text-muted-foreground">Enforcement Policy</span>
                    <span className="font-mono text-foreground">{row.policy}</span>
                  </div>
                  <div className="flex justify-between px-3.5 py-2">
                    <span className="text-muted-foreground">Source Type</span>
                    <span className="font-medium text-foreground">{row.threatSource}</span>
                  </div>
                </div>
              </div>

              {/* Metadata Tags */}
              <div>
                <p className="font-semibold text-muted-foreground text-[11px] uppercase tracking-wider mb-2">
                  Metadata Tags
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(row.metadataTags).map(([k, v]) => (
                    <span
                      key={k}
                      className="rounded-md border border-border bg-muted/40 px-2.5 py-1 font-mono text-xs text-foreground"
                    >
                      <span className="text-muted-foreground">{k}:</span> {v}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === "payload" && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">
                    Content / Prompt
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(row.content, "Content")}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    <Copy className="h-3 w-3" />
                    Copy
                  </button>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3 font-mono text-[12px] text-foreground break-all whitespace-pre-wrap">
                  {row.content}
                </div>
              </div>

              <div>
                <span className="font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">
                  Active Policy Rule
                </span>
                <div className="mt-1.5 rounded-lg border border-border bg-muted/30 p-3 font-mono text-xs text-muted-foreground">
                  Policy: <strong className="text-foreground">{row.policy}</strong>
                  <br />
                  Containment Action:{" "}
                  <span className="font-semibold text-rose-600">
                    {row.projectMode === "Protect" ? "BLOCK / KILL" : "ALLOW / LOG"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "raw" && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">
                  Raw JSON Payload
                </span>
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(
                      JSON.stringify(row.rawEvent ?? row, null, 2),
                      "JSON Payload"
                    )
                  }
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  <Copy className="h-3 w-3" />
                  Copy JSON
                </button>
              </div>
              <pre className="rounded-lg border border-border bg-muted/40 p-3 font-mono text-[11px] text-foreground overflow-x-auto max-h-[380px]">
                {JSON.stringify(row.rawEvent ?? row, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Drawer Footer Actions */}
        <div className="border-t border-border/80 px-5 py-3 flex items-center justify-between bg-muted/10">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => copyToClipboard(row.requestId, "Request ID")}
            className="text-xs"
          >
            Copy Request ID
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => {
              toast("Rule generator opened", {
                description: `Drafting hot-patch policy for ${row.policy}`,
                variant: "success",
              });
            }}
            className="text-xs"
          >
            Create Mitigation Rule
          </Button>
        </div>
      </div>
    </>
  );
}
