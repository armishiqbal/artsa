"use client";

import { useState } from "react";
import { RotateCw, Download, Link2, Check, FileSpreadsheet, FileJson } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/stores/toast";
import { cn } from "@/lib/utils";

interface LogsHeaderProps {
  toggle: "all" | "threats";
  onToggleChange: (val: "all" | "threats") => void;
  onUpdateData: () => Promise<void> | void;
  onExport: (format: "csv" | "json" | "ndjson") => void;
  isUpdating?: boolean;
}

export function LogsHeader({
  toggle,
  onToggleChange,
  onUpdateData,
  onExport,
  isUpdating = false,
}: LogsHeaderProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    try {
      if (typeof window !== "undefined") {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        toast("Link copied to clipboard", {
          description: "Active filter state saved in URL",
          variant: "success",
        });
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      toast("Unable to copy link", { variant: "error" });
    }
  };

  return (
    <div className="space-y-4">
      {/* Title and Subtitle */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">
          Logs
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Investigate requests and detected threats to identify malicious actors, vulnerabilities, and mitigating actions to take.
        </p>
      </div>

      {/* Control bar: Left toggle, Right action buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        {/* All Requests | Threats segmented toggle */}
        <div className="inline-flex items-center rounded-lg border border-border bg-muted/30 p-1 shadow-xs">
          <button
            type="button"
            onClick={() => onToggleChange("all")}
            className={cn(
              "rounded-md px-3.5 py-1.5 text-xs font-medium transition-all",
              toggle === "all"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            All Requests
          </button>
          <button
            type="button"
            onClick={() => onToggleChange("threats")}
            className={cn(
              "rounded-md px-3.5 py-1.5 text-xs font-medium transition-all",
              toggle === "threats"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Threats
          </button>
        </div>

        {/* Right side actions: Update data, Export, Share Link */}
        <div className="flex items-center gap-2">
          {/* Update data */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void onUpdateData()}
            disabled={isUpdating}
            className="h-9 gap-1.5 rounded-lg border-border bg-background px-3 text-xs font-medium text-foreground hover:bg-muted/50"
          >
            <span>Update data</span>
            <RotateCw
              className={cn("h-3.5 w-3.5 text-muted-foreground", isUpdating && "animate-spin text-primary")}
            />
          </Button>

          {/* Export Dropdown */}
          <div className="relative">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setExportOpen(!exportOpen)}
              className="h-9 w-9 rounded-lg border-border bg-background text-foreground hover:bg-muted/50"
              title="Export data"
              aria-label="Export logs"
            >
              <Download className="h-4 w-4 text-muted-foreground" />
            </Button>

            {exportOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setExportOpen(false)}
                />
                <div className="absolute right-0 top-full z-50 mt-1.5 w-44 rounded-lg border border-border bg-popover p-1 text-xs shadow-lg animate-in fade-in-50 zoom-in-95">
                  <button
                    type="button"
                    onClick={() => {
                      onExport("csv");
                      setExportOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-popover-foreground hover:bg-muted"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-muted-foreground" />
                    Export as CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onExport("json");
                      setExportOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-popover-foreground hover:bg-muted"
                  >
                    <FileJson className="h-3.5 w-3.5 text-muted-foreground" />
                    Export as JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onExport("ndjson");
                      setExportOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-popover-foreground hover:bg-muted"
                  >
                    <Download className="h-3.5 w-3.5 text-muted-foreground" />
                    Export as NDJSON
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Share link button */}
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => void handleCopyLink()}
            className="h-9 w-9 rounded-lg border-border bg-background text-foreground hover:bg-muted/50"
            title="Copy link with filters"
            aria-label="Copy link with filters"
          >
            {copied ? (
              <Check className="h-4 w-4 text-emerald-600" />
            ) : (
              <Link2 className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
