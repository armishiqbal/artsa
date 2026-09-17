"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Search,
  Check,
  SlidersHorizontal,
  Calendar,
  X,
  Plus,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useProjectsStore } from "@/lib/stores/projects";
import type { LogsDateRange, LogsFilterState } from "@/lib/logsTypes";
import { cn } from "@/lib/utils";

interface LogsFilterBarProps {
  filters: LogsFilterState;
  onFilterChange: (newFilters: LogsFilterState) => void;
  onClearFilters: () => void;
}

type FilterCategory =
  | "Detection result"
  | "Processing region"
  | "Model"
  | "Application"
  | "Project metadata"
  | "Request metadata"
  | "Request IDs";

const CATEGORIES: FilterCategory[] = [
  "Detection result",
  "Processing region",
  "Model",
  "Application",
  "Project metadata",
  "Request metadata",
  "Request IDs",
];

const DETECTION_OPTIONS = [
  "No detections",
  "Prompt attack",
  "Data leakage",
  "Content violation",
  "Unknown links",
  "Deny-listed",
  "Custom guardrail",
  "Dangerous Deviation",
];

const REGION_OPTIONS = [
  "us-east-1",
  "us-west-2",
  "eu-west-1",
  "ap-southeast-1",
  "global",
];

const MODEL_OPTIONS = [
  "gpt-4o",
  "gpt-4o-mini",
  "claude-3-5-sonnet",
  "gemini-1.5-pro",
  "llama-3.1-70b",
];

const APP_OPTIONS = [
  "artsa-agent",
  "customer-support",
  "code-interpreter",
  "data-analyst",
];

const PROJECT_META_OPTIONS = [
  "env:production",
  "env:staging",
  "team:redteam",
  "team:secops",
];

const REQUEST_META_OPTIONS = [
  "status:200",
  "status:403",
  "status:429",
  "high-latency (>100ms)",
];

const DATE_OPTIONS: Array<{ label: string; value: LogsDateRange }> = [
  { label: "Today", value: "today" },
  { label: "Yesterday", value: "yesterday" },
  { label: "Last 24 hours", value: "24h" },
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "All time", value: "all" },
];

export function LogsFilterBar({
  filters,
  onFilterChange,
  onClearFilters,
}: LogsFilterBarProps) {
  const [projectOpen, setProjectOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<FilterCategory>("Detection result");

  const [dateOpen, setDateOpen] = useState(false);

  const { projects, loadProjects, addProject } = useProjectsStore();

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Active filter count (excluding project and date)
  const activeCount = useMemo(() => {
    return (
      filters.detectionResults.length +
      filters.regions.length +
      filters.models.length +
      filters.applications.length +
      filters.projectMetadata.length +
      filters.requestMetadata.length +
      (filters.requestIds ? 1 : 0)
    );
  }, [filters]);

  const toggleArrayItem = (arr: string[], item: string): string[] => {
    return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
  };

  const getActiveProjectLabel = (val: string) => {
    if (val === "none") return "No project";
    if (val === "all") return "All projects";
    const found = projects.find((p) => p.id === val);
    return found ? found.name : "All projects";
  };

  const activeDateLabel = useMemo(() => {
    return DATE_OPTIONS.find((d) => d.value === filters.dateRange)?.label ?? "Today";
  }, [filters.dateRange]);

  const filteredProjects = useMemo(() => {
    const q = projectSearch.toLowerCase().trim();
    if (!q) return projects;
    return projects.filter((p) => p.name.toLowerCase().includes(q));
  }, [projects, projectSearch]);

  const handleCreateProject = () => {
    const trimmed = projectSearch.trim();
    if (!trimmed) return;
    const created = addProject(trimmed);
    onFilterChange({ ...filters, project: created.id });
    setProjectSearch("");
    setProjectOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 pt-2 pb-1">
      {/* 1. All projects dropdown (Matching Screenshot 1 & 4) */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setProjectOpen(!projectOpen);
            setFiltersOpen(false);
            setDateOpen(false);
          }}
          className={cn(
            "flex h-9 items-center justify-between gap-2.5 rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground shadow-xs transition-colors hover:bg-muted/50",
            projectOpen && "border-primary ring-1 ring-primary"
          )}
        >
          <span>{getActiveProjectLabel(filters.project)}</span>
          {projectOpen ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>

        {projectOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setProjectOpen(false)}
            />
            <div className="absolute left-0 top-full z-50 mt-1.5 w-64 rounded-xl border border-border bg-popover p-1 text-xs shadow-xl animate-in fade-in-50 zoom-in-95">
              {/* Search input matching screenshot */}
              <div className="relative p-1">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                  placeholder="Search projects..."
                  className="h-8 pl-8 text-xs"
                  autoFocus
                />
              </div>

              <div className="my-1 border-t border-border/60" />

              <div className="space-y-0.5 p-1 max-h-56 overflow-y-auto">
                {/* All projects option */}
                <button
                  type="button"
                  onClick={() => {
                    onFilterChange({ ...filters, project: "all" });
                    setProjectOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs transition-colors",
                    filters.project === "all"
                      ? "bg-muted font-medium text-foreground"
                      : "text-foreground hover:bg-muted/60"
                  )}
                >
                  <span>All projects</span>
                  {filters.project === "all" && (
                    <Check className="h-3.5 w-3.5 text-foreground" />
                  )}
                </button>

                {/* Dynamically created projects ONLY */}
                {filteredProjects.map((p) => {
                  const isSelected = filters.project === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        onFilterChange({ ...filters, project: p.id });
                        setProjectOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs transition-colors",
                        isSelected
                          ? "bg-muted font-medium text-foreground"
                          : "text-foreground hover:bg-muted/60"
                      )}
                    >
                      <span>{p.name}</span>
                      {isSelected && <Check className="h-3.5 w-3.5 text-foreground" />}
                    </button>
                  );
                })}

                {/* No project option matching screenshot */}
                <button
                  type="button"
                  onClick={() => {
                    onFilterChange({ ...filters, project: "none" });
                    setProjectOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs transition-colors",
                    filters.project === "none"
                      ? "bg-muted font-medium text-foreground"
                      : "text-foreground hover:bg-muted/60"
                  )}
                >
                  <span>No project</span>
                  {filters.project === "none" && (
                    <Check className="h-3.5 w-3.5 text-foreground" />
                  )}
                </button>

                {/* Option to create project if typing a new name */}
                {projectSearch.trim() &&
                  !projects.some(
                    (p) => p.name.toLowerCase() === projectSearch.trim().toLowerCase()
                  ) && (
                    <button
                      type="button"
                      onClick={handleCreateProject}
                      className="mt-1 flex w-full items-center gap-1.5 rounded-md border border-dashed border-border px-2.5 py-1.5 text-left text-xs text-primary hover:bg-primary/5"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Create project &ldquo;{projectSearch.trim()}&rdquo;</span>
                    </button>
                  )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* 2. Filters 2-Column Popover (Matching Screenshot 3) */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setFiltersOpen(!filtersOpen);
            setProjectOpen(false);
            setDateOpen(false);
          }}
          className={cn(
            "flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground shadow-xs transition-colors hover:bg-muted/50",
            (filtersOpen || activeCount > 0) && "border-primary ring-1 ring-primary"
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Filters</span>
          {activeCount > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono text-[10px] text-primary-foreground">
              {activeCount}
            </span>
          )}
        </button>

        {filtersOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setFiltersOpen(false)}
            />
            <div className="absolute left-0 top-full z-50 mt-1.5 flex h-[350px] w-[470px] rounded-xl border border-border bg-popover text-xs shadow-2xl animate-in fade-in-50 zoom-in-95">
              {/* Left Column: Categories (Matching Screenshot 3) */}
              <div className="w-48 border-r border-border/70 p-2 space-y-1 bg-[#f9fafb] dark:bg-muted/20">
                {CATEGORIES.map((cat) => {
                  const isActive = activeCategory === cat;
                  let count = 0;
                  if (cat === "Detection result") count = filters.detectionResults.length;
                  if (cat === "Processing region") count = filters.regions.length;
                  if (cat === "Model") count = filters.models.length;
                  if (cat === "Application") count = filters.applications.length;
                  if (cat === "Project metadata") count = filters.projectMetadata.length;
                  if (cat === "Request metadata") count = filters.requestMetadata.length;
                  if (cat === "Request IDs" && filters.requestIds) count = 1;

                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setActiveCategory(cat)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-colors",
                        isActive
                          ? "bg-muted/80 font-medium text-foreground shadow-xs"
                          : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                      )}
                    >
                      <span className="truncate">{cat}</span>
                      <div className="flex items-center gap-1.5">
                        {count > 0 && (
                          <span className="rounded-full bg-primary/20 px-1.5 py-0.2 font-mono text-[9px] text-primary">
                            {count}
                          </span>
                        )}
                        <ChevronRight className="h-3.5 w-3.5 opacity-50" />
                      </div>
                    </button>
                  );
                })}

                {activeCount > 0 && (
                  <div className="pt-3 px-2">
                    <button
                      type="button"
                      onClick={() => onClearFilters()}
                      className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground underline"
                    >
                      <X className="h-3 w-3" />
                      Reset filters
                    </button>
                  </div>
                )}
              </div>

              {/* Right Column: Checkbox Options (Matching Screenshot 3) */}
              <div className="flex-1 overflow-y-auto p-4 bg-background">
                {activeCategory === "Detection result" && (
                  <div className="space-y-2.5">
                    {DETECTION_OPTIONS.map((opt) => {
                      const checked = filters.detectionResults.includes(opt);
                      return (
                        <label
                          key={opt}
                          className="flex cursor-pointer items-center gap-3 rounded-md px-1 py-1 transition-colors hover:bg-muted/30"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              onFilterChange({
                                ...filters,
                                detectionResults: toggleArrayItem(filters.detectionResults, opt),
                              })
                            }
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary dark:border-gray-600"
                          />
                          <span className="text-xs text-foreground font-normal">{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {activeCategory === "Processing region" && (
                  <div className="space-y-2.5">
                    {REGION_OPTIONS.map((opt) => {
                      const checked = filters.regions.includes(opt);
                      return (
                        <label
                          key={opt}
                          className="flex cursor-pointer items-center gap-3 rounded-md px-1 py-1 transition-colors hover:bg-muted/30"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              onFilterChange({
                                ...filters,
                                regions: toggleArrayItem(filters.regions, opt),
                              })
                            }
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary dark:border-gray-600"
                          />
                          <span className="text-xs text-foreground font-normal">{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {activeCategory === "Model" && (
                  <div className="space-y-2.5">
                    {MODEL_OPTIONS.map((opt) => {
                      const checked = filters.models.includes(opt);
                      return (
                        <label
                          key={opt}
                          className="flex cursor-pointer items-center gap-3 rounded-md px-1 py-1 transition-colors hover:bg-muted/30"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              onFilterChange({
                                ...filters,
                                models: toggleArrayItem(filters.models, opt),
                              })
                            }
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary dark:border-gray-600"
                          />
                          <span className="text-xs text-foreground font-normal">{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {activeCategory === "Application" && (
                  <div className="space-y-2.5">
                    {APP_OPTIONS.map((opt) => {
                      const checked = filters.applications.includes(opt);
                      return (
                        <label
                          key={opt}
                          className="flex cursor-pointer items-center gap-3 rounded-md px-1 py-1 transition-colors hover:bg-muted/30"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              onFilterChange({
                                ...filters,
                                applications: toggleArrayItem(filters.applications, opt),
                              })
                            }
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary dark:border-gray-600"
                          />
                          <span className="text-xs text-foreground font-normal">{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {activeCategory === "Project metadata" && (
                  <div className="space-y-2.5">
                    {PROJECT_META_OPTIONS.map((opt) => {
                      const checked = filters.projectMetadata.includes(opt);
                      return (
                        <label
                          key={opt}
                          className="flex cursor-pointer items-center gap-3 rounded-md px-1 py-1 transition-colors hover:bg-muted/30"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              onFilterChange({
                                ...filters,
                                projectMetadata: toggleArrayItem(filters.projectMetadata, opt),
                              })
                            }
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary dark:border-gray-600"
                          />
                          <span className="text-xs text-foreground font-normal">{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {activeCategory === "Request metadata" && (
                  <div className="space-y-2.5">
                    {REQUEST_META_OPTIONS.map((opt) => {
                      const checked = filters.requestMetadata.includes(opt);
                      return (
                        <label
                          key={opt}
                          className="flex cursor-pointer items-center gap-3 rounded-md px-1 py-1 transition-colors hover:bg-muted/30"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              onFilterChange({
                                ...filters,
                                requestMetadata: toggleArrayItem(filters.requestMetadata, opt),
                              })
                            }
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary dark:border-gray-600"
                          />
                          <span className="text-xs text-foreground font-normal">{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {activeCategory === "Request IDs" && (
                  <div className="space-y-3 p-1">
                    <p className="text-muted-foreground text-[11px]">
                      Filter requests by exact or partial Request ID
                    </p>
                    <Input
                      value={filters.requestIds}
                      onChange={(e) =>
                        onFilterChange({ ...filters, requestIds: e.target.value })
                      }
                      placeholder="e.g. req_9b1f280a"
                      className="h-8 text-xs"
                    />
                    {filters.requestIds && (
                      <button
                        type="button"
                        onClick={() => onFilterChange({ ...filters, requestIds: "" })}
                        className="text-xs text-muted-foreground hover:text-foreground underline"
                      >
                        Clear ID filter
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* 3. Today Date picker button (Matching Screenshot 1 & 2) */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setDateOpen(!dateOpen);
            setProjectOpen(false);
            setFiltersOpen(false);
          }}
          className={cn(
            "flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground shadow-xs transition-colors hover:bg-muted/50",
            dateOpen && "border-primary ring-1 ring-primary"
          )}
        >
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{activeDateLabel}</span>
        </button>

        {dateOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setDateOpen(false)}
            />
            <div className="absolute left-0 top-full z-50 mt-1.5 w-44 rounded-xl border border-border bg-popover p-1 text-xs shadow-xl animate-in fade-in-50 zoom-in-95">
              <div className="space-y-0.5 p-1">
                {DATE_OPTIONS.map((d) => {
                  const isSelected = filters.dateRange === d.value;
                  return (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => {
                        onFilterChange({ ...filters, dateRange: d.value });
                        setDateOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs transition-colors",
                        isSelected
                          ? "bg-muted font-medium text-foreground"
                          : "text-foreground hover:bg-muted/60"
                      )}
                    >
                      <span>{d.label}</span>
                      {isSelected && <Check className="h-3.5 w-3.5 text-foreground" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
