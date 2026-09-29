"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  XCircle,
  Play,
  Terminal,
  Database,
  FileCode,
  Globe,
  BookOpen,
  Shield,
  Layers,
  Sparkles,
} from "lucide-react";
import type { CuratePreviewResult, TargetSurfaceConfig } from "@/lib/types/research";
import { cn } from "@/lib/utils";

interface CapabilityFilterSimulatorProps {
  onSimulate: (surface: TargetSurfaceConfig) => Promise<CuratePreviewResult | null>;
  simulating: boolean;
  curateResult: CuratePreviewResult | null;
  onPromoteRetained?: (surface: TargetSurfaceConfig) => void;
  promoting?: boolean;
}

const AVAILABLE_TOOLS = [
  { id: "database_query", label: "database_query", flag: "has_database", icon: Database, desc: "SQL / relational database query tool" },
  { id: "bash_exec", label: "bash_exec", flag: "has_bash", icon: Terminal, desc: "Shell command execution / bash script runner" },
  { id: "read_file", label: "read_file", flag: "has_filesystem", icon: FileCode, desc: "Local filesystem read & write access" },
  { id: "web_search", label: "web_search", flag: null, icon: Globe, desc: "External search & HTTP document retrieval" },
  { id: "rag_retrieval", label: "rag_retrieval", flag: "has_rag", icon: BookOpen, desc: "Vector store semantic embedding retrieval" },
  { id: "admin_override", label: "admin_override", flag: "has_admin_tools", icon: Shield, desc: "Privileged administrator & sudo credentials" },
];

const PRESETS: Array<{ name: string; tools: string[]; flags: Partial<TargetSurfaceConfig> }> = [
  {
    name: "Minimal Chatbot",
    tools: [],
    flags: { has_database: false, has_bash: false, has_filesystem: false, has_rag: false, has_admin_tools: false },
  },
  {
    name: "RAG Search Agent",
    tools: ["web_search", "rag_retrieval"],
    flags: { has_database: false, has_bash: false, has_filesystem: false, has_rag: true, has_admin_tools: false },
  },
  {
    name: "SQL Analytics Agent",
    tools: ["database_query", "web_search"],
    flags: { has_database: true, has_bash: false, has_filesystem: false, has_rag: false, has_admin_tools: false },
  },
  {
    name: "DevOps & Coding Agent",
    tools: ["bash_exec", "read_file", "write_file"],
    flags: { has_database: false, has_bash: true, has_filesystem: true, has_rag: false, has_admin_tools: false },
  },
  {
    name: "Autonomous Enterprise Agent",
    tools: ["database_query", "bash_exec", "read_file", "web_search", "rag_retrieval", "admin_override"],
    flags: { has_database: true, has_bash: true, has_filesystem: true, has_rag: true, has_admin_tools: true },
  },
];

export function CapabilityFilterSimulator({
  onSimulate,
  simulating,
  curateResult,
  onPromoteRetained,
  promoting,
}: CapabilityFilterSimulatorProps) {
  const [selectedTools, setSelectedTools] = useState<string[]>(["web_search", "rag_retrieval"]);
  const [activeTab, setActiveTab] = useState<"retained" | "discarded">("retained");

  const toggleTool = (id: string) => {
    setSelectedTools((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  };

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setSelectedTools(preset.tools);
  };

  const currentSurface: TargetSurfaceConfig = {
    tools: selectedTools,
    has_database: selectedTools.includes("database_query"),
    has_bash: selectedTools.includes("bash_exec"),
    has_filesystem: selectedTools.includes("read_file"),
    has_rag: selectedTools.includes("rag_retrieval"),
    has_admin_tools: selectedTools.includes("admin_override"),
  };

  const handleRunSimulation = async () => {
    await onSimulate(currentSurface);
  };

  return (
    <div className="space-y-6">
      {/* Target Attack Surface Builder */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-[14px] text-foreground flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              Target Agent Attack Surface Builder
            </h3>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Configure the tools and capabilities of the target agent to simulate how the Curator Agent filters threat vectors.
            </p>
          </div>

          <Button
            onClick={handleRunSimulation}
            disabled={simulating}
            size="sm"
            className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-mono text-[12px] cursor-pointer"
          >
            <Play className={`h-3.5 w-3.5 fill-current ${simulating ? "animate-pulse" : ""}`} />
            {simulating ? "Simulating Curator…" : "Simulate Curator Filter"}
          </Button>
        </div>

        {/* Quick Presets */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/60">
          <span className="text-[11px] font-mono text-muted-foreground uppercase mr-1">Presets:</span>
          {PRESETS.map((p) => {
            const isMatch =
              p.tools.length === selectedTools.length && p.tools.every((t) => selectedTools.includes(t));
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => applyPreset(p)}
                className={cn(
                  "rounded px-2.5 py-1 text-[11px] font-mono border transition-colors cursor-pointer",
                  isMatch
                    ? "border-primary bg-primary/10 text-primary font-semibold"
                    : "border-border/60 bg-muted/30 text-muted-foreground hover:text-foreground"
                )}
              >
                {p.name}
              </button>
            );
          })}
        </div>

        {/* Tool Cards Checklist */}
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 pt-1">
          {AVAILABLE_TOOLS.map((tool) => {
            const isChecked = selectedTools.includes(tool.id);
            const Icon = tool.icon;
            return (
              <div
                key={tool.id}
                onClick={() => toggleTool(tool.id)}
                className={cn(
                  "flex items-start gap-2.5 rounded-lg border p-2.5 cursor-pointer transition-all select-none",
                  isChecked
                    ? "border-primary/60 bg-primary/[0.04]"
                    : "border-border/60 bg-muted/20 opacity-70 hover:opacity-100"
                )}
              >
                <div
                  className={cn(
                    "mt-0.5 rounded p-1 border",
                    isChecked ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] font-bold text-foreground truncate">
                      {tool.label}
                    </span>
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        isChecked ? "bg-emerald-500" : "bg-muted-foreground/30"
                      )}
                    />
                  </div>
                  <p className="mt-0.5 text-[10px] text-muted-foreground leading-tight line-clamp-1">
                    {tool.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Curator Filtering Results */}
      {curateResult && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <div className="flex items-center gap-3">
              <div className="flex rounded-md border border-border bg-muted/40 p-0.5 text-[12px] font-mono">
                <button
                  type="button"
                  onClick={() => setActiveTab("retained")}
                  className={cn(
                    "rounded px-3 py-1 transition-colors cursor-pointer flex items-center gap-1.5",
                    activeTab === "retained"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Retained Seeds ({curateResult.retained_count})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("discarded")}
                  className={cn(
                    "rounded px-3 py-1 transition-colors cursor-pointer flex items-center gap-1.5",
                    activeTab === "discarded"
                      ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <XCircle className="h-3.5 w-3.5 text-rose-500" />
                  <span>Discarded ({curateResult.discarded_count})</span>
                </button>
              </div>

              <span className="font-mono text-[11px] text-muted-foreground">
                Evaluated {curateResult.total_considered} threats against target surface
              </span>
            </div>

            {onPromoteRetained && curateResult.retained_count > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPromoteRetained(currentSurface)}
                disabled={promoting}
                className="gap-2 border-emerald-500/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 font-mono text-[11px] cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{promoting ? "Promoting Seeds…" : `Promote ${curateResult.retained_count} Seeds to Library`}</span>
              </Button>
            )}
          </div>

          {activeTab === "retained" ? (
            <div className="grid gap-2.5">
              {curateResult.retained.map((item) => (
                <div
                  key={item.record.framework_id || item.record.id}
                  className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.02] p-3.5 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[12px] font-bold text-foreground">
                        {item.record.framework_id}
                      </span>
                      <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/40 text-emerald-500">
                        RETAINED
                      </Badge>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        [{item.record.source}] · {item.record.category}
                      </span>
                    </div>
                  </div>

                  <p className="text-[13px] font-medium text-foreground">{item.record.title}</p>
                  <p className="text-[12px] text-muted-foreground leading-normal">{item.record.description}</p>

                  {item.preview_seeds && item.preview_seeds.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border/50">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <Sparkles className="h-3 w-3" />
                        Synthesized Attack Template Seed ({item.preview_seeds.length}):
                      </span>
                      <div className="mt-1 space-y-1">
                        {item.preview_seeds.map((s, idx) => (
                          <div
                            key={idx}
                            className="rounded border border-border/80 bg-background/90 p-2 font-mono text-[11px] text-foreground"
                          >
                            <span className="text-muted-foreground font-semibold">{s.name}: </span>
                            <span className="text-emerald-600 dark:text-emerald-400">{s.template}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-2.5">
              {curateResult.discarded.map((item) => (
                <div
                  key={item.record.framework_id || item.record.id}
                  className="rounded-lg border border-border/60 bg-muted/10 p-3.5 space-y-2 opacity-80 hover:opacity-100 transition-opacity"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[12px] font-semibold text-muted-foreground">
                        {item.record.framework_id}
                      </span>
                      <Badge variant="outline" className="text-[10px] font-mono border-rose-500/40 text-rose-500">
                        DISCARDED
                      </Badge>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        [{item.record.source}]
                      </span>
                    </div>
                  </div>

                  <p className="text-[13px] font-medium text-foreground/80">{item.record.title}</p>

                  <div className="rounded border border-rose-500/20 bg-rose-500/5 px-2.5 py-1.5 font-mono text-[11px] text-rose-600 dark:text-rose-400 flex items-center gap-2">
                    <XCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>Curator Rationale: {item.rationale}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
