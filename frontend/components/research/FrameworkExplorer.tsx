"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  Terminal,
  Database,
  FileCode,
  Tag,
  CheckSquare,
  Square,
  Sparkles,
} from "lucide-react";
import type { ThreatIntelligenceRecord } from "@/lib/types/research";
import { cn } from "@/lib/utils";

interface FrameworkExplorerProps {
  threats: ThreatIntelligenceRecord[];
  loading: boolean;
  selectedSource: string | null;
  onSelectSource: (source: string | null) => void;
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedThreatIds: Set<string>;
  onToggleThreatSelect: (id: string) => void;
  onSelectAllVisible: (ids: string[]) => void;
  onClearSelection: () => void;
}

const SOURCES = [
  { id: null, label: "All Frameworks" },
  { id: "OWASP_ASI", label: "OWASP ASI (Agentic Top 10)" },
  { id: "MITRE_ATLAS", label: "MITRE ATLAS" },
  { id: "NIST_AI_RMF", label: "NIST AI RMF 1.0" },
  { id: "NVD_LIVE", label: "NVD Live CVEs" },
  { id: "VULNERABILITY_DISCLOSURE", label: "Advisories" },
];

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "border-rose-500/50 bg-rose-500/10 text-rose-500 dark:text-rose-400",
  HIGH: "border-amber-500/50 bg-amber-500/10 text-amber-500 dark:text-amber-400",
  MEDIUM: "border-yellow-500/50 bg-yellow-500/10 text-yellow-500 dark:text-yellow-400",
  LOW: "border-sky-500/50 bg-sky-500/10 text-sky-500 dark:text-sky-400",
};

export function FrameworkExplorer({
  threats,
  loading,
  selectedSource,
  onSelectSource,
  selectedCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  selectedThreatIds,
  onToggleThreatSelect,
  onSelectAllVisible,
  onClearSelection,
}: FrameworkExplorerProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const t of threats) {
      if (t.category) set.add(t.category);
    }
    return Array.from(set).sort();
  }, [threats]);

  const visibleThreats = useMemo(() => {
    return threats.filter((t) => {
      if (selectedSource && t.source !== selectedSource) return false;
      if (selectedCategory && t.category !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inTitle = t.title.toLowerCase().includes(q);
        const inId = t.framework_id.toLowerCase().includes(q);
        const inDesc = t.description.toLowerCase().includes(q);
        const inTech = t.technical_details.toLowerCase().includes(q);
        const inTags = t.tags.some((tag) => tag.toLowerCase().includes(q));
        if (!inTitle && !inId && !inDesc && !inTech && !inTags) return false;
      }
      return true;
    });
  }, [threats, selectedSource, selectedCategory, searchQuery]);

  const allVisibleSelected =
    visibleThreats.length > 0 && visibleThreats.every((t) => selectedThreatIds.has(t.framework_id || t.id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      onClearSelection();
    } else {
      onSelectAllVisible(visibleThreats.map((t) => t.framework_id || t.id));
    }
  };

  return (
    <div className="space-y-4">
      {/* Source Framework Tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-border pb-3">
        {SOURCES.map((s) => {
          const active = selectedSource === s.id;
          return (
            <button
              key={s.id ?? "all"}
              type="button"
              onClick={() => onSelectSource(s.id)}
              className={cn(
                "rounded-md px-3 py-1.5 text-[12px] font-mono transition-colors cursor-pointer",
                active
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Search, Category Filter & Bulk Selection Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2 min-w-[260px]">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search threat title, CVE ID, technique, or prerequisite..."
              className="pl-8 h-8 text-[12px] font-mono"
            />
          </div>
          {selectedCategory && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSelectCategory(null)}
              className="h-8 text-[11px] font-mono text-muted-foreground hover:text-foreground"
            >
              Clear Category ✕
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleSelectAll}
            className="h-8 text-[11px] font-mono gap-1.5 cursor-pointer"
          >
            {allVisibleSelected ? <CheckSquare className="h-3.5 w-3.5 text-emerald-500" /> : <Square className="h-3.5 w-3.5" />}
            <span>{allVisibleSelected ? "Deselect Visible" : `Select All (${visibleThreats.length})`}</span>
          </Button>

          <span className="font-mono text-[11px] text-muted-foreground">
            {selectedThreatIds.size} selected
          </span>
        </div>
      </div>

      {/* Category Filter Chips */}
      {categories.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mr-1">
            Categories:
          </span>
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => onSelectCategory(isSelected ? null : cat)}
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wide border transition-colors cursor-pointer",
                  isSelected
                    ? "border-primary bg-primary/10 text-primary font-bold"
                    : "border-border/60 bg-muted/30 text-muted-foreground hover:text-foreground"
                )}
              >
                {cat}
              </button>
            );
          })}
        </div>
      )}

      {/* Threats List */}
      {loading ? (
        <div className="py-12 text-center text-muted-foreground font-mono text-[13px] animate-pulse">
          Loading threat intelligence framework records…
        </div>
      ) : visibleThreats.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-[13px] text-muted-foreground font-mono">
          No threat findings match your current filters. Try syncing live feeds or clearing filters.
        </div>
      ) : (
        <div className="grid gap-2.5">
          {visibleThreats.map((threat) => {
            const threatKey = threat.framework_id || threat.id;
            const isSelected = selectedThreatIds.has(threatKey);
            const isExpanded = expandedId === threatKey;
            const sevClass = SEVERITY_COLORS[threat.severity] || "border-border text-muted-foreground";

            return (
              <div
                key={threatKey}
                className={cn(
                  "rounded-lg border transition-all duration-150 overflow-hidden",
                  isSelected
                    ? "border-emerald-500/50 bg-emerald-500/[0.02]"
                    : "border-border hover:border-border/80 bg-card",
                  isExpanded && "shadow-sm"
                )}
              >
                <div className="flex items-center gap-3 p-3">
                  <button
                    type="button"
                    onClick={() => onToggleThreatSelect(threatKey)}
                    className="cursor-pointer text-muted-foreground hover:text-foreground"
                    title={isSelected ? "Deselect threat" : "Select threat for curation"}
                  >
                    {isSelected ? (
                      <CheckSquare className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : threatKey)}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[12px] font-bold text-foreground">
                        {threat.framework_id}
                      </span>
                      <Badge variant="outline" className={cn("text-[10px] font-mono px-1.5 py-0 uppercase", sevClass)}>
                        {threat.severity}
                      </Badge>
                      <span className="text-[11px] font-mono text-muted-foreground uppercase">
                        [{threat.source}]
                      </span>
                      <span className="text-[11px] font-mono text-muted-foreground">
                        · {threat.category}
                      </span>
                    </div>
                    <p className="mt-1 text-[13px] font-medium text-foreground truncate">
                      {threat.title}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : threatKey)}
                    className="p-1 text-muted-foreground hover:text-foreground cursor-pointer rounded"
                  >
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                </div>

                {isExpanded && (
                  <div className="border-t border-border/60 bg-muted/20 p-4 space-y-3 text-[12px]">
                    <div>
                      <h4 className="font-semibold text-foreground">Description</h4>
                      <p className="mt-0.5 text-muted-foreground leading-relaxed">
                        {threat.description}
                      </p>
                    </div>

                    {threat.technical_details && (
                      <div>
                        <h4 className="font-semibold text-foreground">Technical Details & Risk Surface</h4>
                        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground bg-muted/50 p-2.5 rounded border border-border/50 whitespace-pre-wrap">
                          {threat.technical_details}
                        </p>
                      </div>
                    )}

                    {threat.prerequisites && threat.prerequisites.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-foreground flex items-center gap-1.5">
                          <Terminal className="h-3.5 w-3.5 text-amber-500" />
                          Prerequisites & Required Tools
                        </h4>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {threat.prerequisites.map((p) => (
                            <span
                              key={p}
                              className="font-mono text-[10px] px-2 py-0.5 rounded border border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            >
                              {p}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {threat.suggested_vectors && threat.suggested_vectors.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-foreground flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                          Suggested Attack Vectors / Probe Seeds
                        </h4>
                        <div className="mt-1 space-y-1">
                          {threat.suggested_vectors.map((vec, i) => (
                            <p
                              key={i}
                              className="font-mono text-[11px] text-foreground/90 bg-background/80 p-2 rounded border border-border"
                            >
                              {vec}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    {threat.tags && threat.tags.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 pt-1">
                        <Tag className="h-3 w-3 text-muted-foreground mr-1" />
                        {threat.tags.map((t) => (
                          <span
                            key={t}
                            className="font-mono text-[9px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
