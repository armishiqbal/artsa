"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, Radio, CheckCircle2, ShieldAlert } from "lucide-react";
import type { SyncThreatsResult } from "@/lib/types/research";

interface ThreatSyncModalProps {
  onSync: (query: string, limit: number) => Promise<SyncThreatsResult | null>;
  syncing: boolean;
}

export function ThreatSyncModal({ onSync, syncing }: ThreatSyncModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("LLM agent");
  const [limit, setLimit] = useState(10);
  const [lastResult, setLastResult] = useState<SyncThreatsResult | null>(null);

  const handleSync = async () => {
    const res = await onSync(query, limit);
    if (res) {
      setLastResult(res);
    }
  };

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen((prev) => !prev)}
        className="gap-2 border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-400 cursor-pointer font-mono text-[12px]"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin text-emerald-500" : ""}`} />
        <span>Sync Live Feeds</span>
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-10 z-50 w-96 rounded-lg border border-border bg-popover/95 p-4 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-[#0c1017]">
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-emerald-500 animate-pulse" />
              <h3 className="font-semibold text-[13px] text-foreground">Live Threat Feeds Ingestion</h3>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-muted-foreground hover:text-foreground text-[12px] px-1.5 py-0.5 rounded"
            >
              ✕
            </button>
          </div>

          <p className="mt-2 text-[12px] text-muted-foreground leading-normal">
            Query live NIST National Vulnerability Database (NVD) CVE disclosures and sync the latest MITRE ATLAS
            adversarial AI matrix.
          </p>

          <div className="mt-3 space-y-2.5">
            <div>
              <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                Query Term
              </label>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. LLM agent, prompt injection"
                className="mt-1 h-8 text-[12px] font-mono"
                disabled={syncing}
              />
            </div>

            <div>
              <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                Max CVE Records
              </label>
              <div className="mt-1 flex gap-2">
                {[5, 10, 25].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setLimit(val)}
                    disabled={syncing}
                    className={`flex-1 rounded border py-1 text-[11px] font-mono transition-colors ${
                      limit === val
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={handleSync}
              disabled={syncing || !query.trim()}
              size="sm"
              className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-[12px] gap-2 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Ingesting Feeds…" : "Execute Feed Sync"}
            </Button>

            {lastResult && (
              <div className="mt-3 rounded border border-emerald-500/30 bg-emerald-500/5 p-2.5 text-[11px] font-mono space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Feed Sync Successful</span>
                </div>
                <div className="grid grid-cols-3 gap-1 pt-1 text-muted-foreground">
                  <div>
                    NVD CVEs: <span className="text-foreground font-semibold">{lastResult.nvd_count}</span>
                  </div>
                  <div>
                    ATLAS: <span className="text-foreground font-semibold">{lastResult.mitre_atlas_count}</span>
                  </div>
                  <div>
                    Total: <span className="text-emerald-500 font-semibold">{lastResult.total_ingested}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
