"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  BookOpen,
  Search,
  Plus,
  Loader2,
  Download,
  Upload,
  X,
  CheckCircle2,
  AlertTriangle,
  FileJson,
  Swords,
  Crosshair,
  Copy,
} from "lucide-react";
import { fetchFromBackend } from "@/lib/api";
import {
  campaignHrefForTemplate,
  expandedProbe,
  sandboxHrefForTemplate,
  templateMetadata,
  templateVariables,
  type AttackTemplateLike,
} from "@/lib/attackLibrary";
import { PageHeader } from "@/components/shared/PageHeader";
import { DashboardCard } from "@/components/shared/DashboardCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageStack } from "@/components/shared/PageStack";
import { PageSuspenseFallback } from "@/components/shared/PageSuspenseFallback";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { lensForCategory, type RiskLens } from "@/lib/assessmentResults";
import { asiForAttackCategory } from "@/lib/asiCategories";
import { toast } from "@/lib/stores/toast";

type TemplateRow = AttackTemplateLike & Record<string, unknown>;

const LENSES: Array<"ALL" | RiskLens> = ["ALL", "Security", "Safety", "Responsible"];

function templateId(t: TemplateRow): string {
  return String(t.id ?? t.name ?? "");
}

interface VersionInfo {
  id?: string;
  name?: string;
  current_version?: number;
  category?: string;
  history?: unknown[];
  note?: string;
}

function LibraryContent() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<{
    categories: Array<{ code: string; name: string }>;
    templates: TemplateRow[];
  }>({ categories: [], templates: [] });
  const [lens, setLens] = useState<"ALL" | RiskLens>("ALL");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [semanticResults, setSemanticResults] = useState<TemplateRow[] | null>(null);
  const [semanticLoading, setSemanticLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: "", category: "DPI", template: "" });
  const [showImport, setShowImport] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; skipped: number } | null>(
    null
  );
  const [importError, setImportError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [versionData, setVersionData] = useState<VersionInfo | null>(null);
  const [versionLoading, setVersionLoading] = useState(false);
  const [showRawProbe, setShowRawProbe] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reload = () =>
    fetchFromBackend<{
      categories: Array<{ code: string; name: string }>;
      templates: TemplateRow[];
    }>("/api/v1/attack-library", { silent: true }).then((d) => {
      if (d) setData(d);
      setLoaded(true);
    });

  useEffect(() => {
    void reload();
  }, []);

  useEffect(() => {
    const category = searchParams.get("category");
    if (category) setSelectedCategory(category.toUpperCase());
  }, [searchParams]);

  const trimmedQuery = searchQuery.trim();
  const useSemanticSearch = trimmedQuery.length >= 2;

  useEffect(() => {
    if (!useSemanticSearch) {
      setSemanticResults(null);
      setSemanticLoading(false);
      return;
    }
    setSemanticLoading(true);
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ q: trimmedQuery, limit: "48" });
      if (selectedCategory !== "ALL") params.set("category", selectedCategory);
      fetchFromBackend<{ results: TemplateRow[] }>(
        `/api/v1/attack-library/search?${params.toString()}`,
        { silent: true }
      )
        .then((res) => {
          if (res) setSemanticResults(res.results ?? []);
        })
        .finally(() => setSemanticLoading(false));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [trimmedQuery, selectedCategory, useSemanticSearch]);

  const createTemplate = async () => {
    if (!newTemplate.name || !newTemplate.template) return;
    await fetchFromBackend("/api/v1/attack-library/templates", {
      method: "POST",
      body: JSON.stringify(newTemplate),
    });
    setNewTemplate({ name: "", category: "DPI", template: "" });
    setShowCreate(false);
    void reload();
  };

  const handleExport = async () => {
    const params = new URLSearchParams();
    if (selectedCategory !== "ALL") params.set("category", selectedCategory);
    const exported = await fetchFromBackend<{ templates: TemplateRow[] }>(
      `/api/v1/attack-library/templates/export?${params.toString()}`,
      { silent: true }
    );
    if (exported?.templates) {
      const blob = new Blob([JSON.stringify(exported.templates, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attack-library-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleBulkImport = async () => {
    if (!importJson.trim()) return;
    setImporting(true);
    setImportResult(null);
    setImportError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(importJson);
    } catch {
      setImportError("Invalid JSON — check braces and quotes.");
      setImporting(false);
      return;
    }
    const templates = Array.isArray(parsed) ? parsed : [parsed];
    try {
      const res = await fetchFromBackend<{ created: number; skipped: number }>(
        "/api/v1/attack-library/templates/bulk-import",
        { method: "POST", body: JSON.stringify({ templates }) }
      );
      if (res) {
        setImportResult(res);
        void reload();
      }
    } catch {
      setImportError("Import failed — the API rejected the payload.");
    } finally {
      setImporting(false);
    }
  };

  const selectObjective = async (t: TemplateRow) => {
    const id = templateId(t);
    setSelectedId(id);
    setShowRawProbe(false);
    setVersionLoading(true);
    const versions = await fetchFromBackend<VersionInfo>(
      `/api/v1/attack-library/templates/${encodeURIComponent(id)}/versions`,
      { silent: true }
    );
    setVersionData(versions);
    setVersionLoading(false);
  };

  const baseList = useSemanticSearch ? (semanticResults ?? []) : data.templates;

  const displayTemplates = useMemo(() => {
    return (baseList || []).filter((t) => {
      const cat = String(t.category ?? "");
      const matchCat = selectedCategory === "ALL" || cat === selectedCategory;
      const matchLens = lens === "ALL" || lensForCategory(cat) === lens;
      if (!matchCat || !matchLens) return false;
      if (useSemanticSearch) return true;
      const q = searchQuery.toLowerCase();
      if (!q) return true;
      const meta = templateMetadata(t);
      return (
        String(t.name ?? "").toLowerCase().includes(q) ||
        String(t.template ?? "").toLowerCase().includes(q) ||
        String(t.description ?? "").toLowerCase().includes(q) ||
        (meta.tags ?? []).some((tag) => tag.toLowerCase().includes(q))
      );
    });
  }, [baseList, selectedCategory, lens, searchQuery, useSemanticSearch]);

  const selected = useMemo(
    () => displayTemplates.find((t) => templateId(t) === selectedId) ?? null,
    [displayTemplates, selectedId]
  );

  const selectedMeta = useMemo(
    () => (selected ? templateMetadata(selected) : null),
    [selected]
  );
  const selectedVars = useMemo(
    () => (selected ? templateVariables(selected) : {}),
    [selected]
  );
  const selectedExpanded = useMemo(
    () => (selected ? expandedProbe(selected) : ""),
    [selected]
  );

  const lensCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: data.templates.length };
    for (const L of ["Security", "Safety", "Responsible"] as RiskLens[]) {
      counts[L] = data.templates.filter((t) => lensForCategory(String(t.category ?? "")) === L)
        .length;
    }
    return counts;
  }, [data.templates]);

  const categoryOptions = useMemo(() => {
    const codes = data.categories?.length
      ? data.categories.map((c) => c.code)
      : Array.from(new Set(data.templates.map((t) => String(t.category ?? "")).filter(Boolean)));
    return codes.filter((code) => lens === "ALL" || lensForCategory(code) === lens);
  }, [data.categories, data.templates, lens]);

  const copyProbe = async () => {
    if (!selectedExpanded) return;
    try {
      await navigator.clipboard.writeText(selectedExpanded);
      toast("Copied expanded probe", { variant: "success" });
    } catch {
      toast("Copy failed", { variant: "error" });
    }
  };

  return (
    <PageStack>
      <PageHeader
        title="Attack Library"
        description="Attack objectives catalog — browse by risk lens, inspect probes, test in Sandbox, or arm a scan."
        icon={<BookOpen className="h-5 w-5" />}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowImport((v) => !v)}>
              <Upload className="h-3.5 w-3.5" />
              Import
            </Button>
            <Button size="sm" variant="outline" onClick={() => void handleExport()}>
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowCreate((v) => !v)}>
              <Plus className="h-3.5 w-3.5" />
              New objective
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/sandbox">
                <Crosshair className="h-3.5 w-3.5" />
                Sandbox
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/campaigns?new=1">
                <Swords className="h-3.5 w-3.5" />
                New scan
              </Link>
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-3 rounded-xl border border-[#313131] bg-[#0a0a0a] p-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={lens} onValueChange={(v) => setLens(v as typeof lens)}>
          <TabsList className="h-8">
            {LENSES.map((L) => (
              <TabsTrigger key={L} value={L} className="text-xs">
                {L === "ALL" ? "All" : L}
                <span className="ml-1.5 font-mono text-[10px] text-[#7c7c7c]">
                  {lensCounts[L] ?? 0}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#7c7c7c]" />
          <Input
            className="h-8 pl-8 text-[13px]"
            placeholder="Search objectives…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setSelectedCategory("ALL")}
          className={cn(
            "rounded-[4px] border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.06em]",
            selectedCategory === "ALL"
              ? "border-[#6798ff]/40 bg-[#1a1f2e] text-[#6798ff]"
              : "border-[#313131] text-[#7c7c7c] hover:text-white"
          )}
        >
          All codes
        </button>
        {categoryOptions.map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => setSelectedCategory(code)}
            className={cn(
              "rounded-[4px] border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.06em]",
              selectedCategory === code
                ? "border-[#6798ff]/40 bg-[#1a1f2e] text-[#6798ff]"
                : "border-[#313131] text-[#7c7c7c] hover:text-white"
            )}
          >
            {code}
          </button>
        ))}
      </div>

      {showImport && (
        <DashboardCard title="Bulk import">
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              JSON array of objectives — each needs <code>name</code>, <code>category</code>,{" "}
              <code>template</code>.
            </p>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <FileJson className="h-3.5 w-3.5" />
              Load file
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => setImportJson(String(reader.result ?? ""));
                reader.readAsText(file);
              }}
            />
            <textarea
              className="min-h-[120px] w-full rounded-md border border-border bg-background p-3 font-mono text-xs"
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              placeholder='[{"name":"…","category":"DPI","template":"…"}]'
            />
            {importError && (
              <p className="flex items-center gap-1.5 text-xs text-status-critical">
                <AlertTriangle className="h-3.5 w-3.5" />
                {importError}
              </p>
            )}
            {importResult && (
              <p className="flex items-center gap-1.5 text-xs text-status-success">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Created {importResult.created}, skipped {importResult.skipped}
              </p>
            )}
            <Button
              size="sm"
              disabled={importing || !importJson.trim()}
              onClick={() => void handleBulkImport()}
            >
              {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Import
            </Button>
          </div>
        </DashboardCard>
      )}

      {showCreate && (
        <DashboardCard title="New objective">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              placeholder="Name"
              value={newTemplate.name}
              onChange={(e) => setNewTemplate((s) => ({ ...s, name: e.target.value }))}
            />
            <select
              className="h-9 rounded-md border border-border bg-background px-3 text-sm"
              value={newTemplate.category}
              onChange={(e) => setNewTemplate((s) => ({ ...s, category: e.target.value }))}
            >
              {(categoryOptions.length ? categoryOptions : ["DPI", "JBK", "SPE", "DEX", "IPI", "PEX", "MSE"]).map(
                (code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                )
              )}
            </select>
            <textarea
              className="min-h-[100px] w-full rounded-md border border-border bg-background p-3 font-mono text-xs sm:col-span-2"
              placeholder="Probe template (supports {{variables}})"
              value={newTemplate.template}
              onChange={(e) => setNewTemplate((s) => ({ ...s, template: e.target.value }))}
            />
            <div className="flex gap-2 sm:col-span-2">
              <Button size="sm" onClick={() => void createTemplate()}>
                Save objective
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DashboardCard>
      )}

      {!loaded ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="overflow-hidden rounded-xl border border-[#313131] bg-[#0a0a0a]">
            <div className="flex items-center justify-between border-b border-[#313131] px-3 py-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#6798ff]">
                Objectives
              </p>
              <p className="font-mono text-[10px] text-[#454545]">
                {semanticLoading ? "Searching…" : `${displayTemplates.length} shown`}
              </p>
            </div>
            {displayTemplates.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="No objectives"
                description="Adjust lens/category filters, or import a catalog."
                className="py-16"
              />
            ) : (
              <div className="max-h-[640px] overflow-y-auto">
                <table className="w-full text-left text-[12px]">
                  <thead className="sticky top-0 border-b border-[#313131] bg-[#141414] font-mono text-[10px] uppercase tracking-[0.08em] text-[#7c7c7c]">
                    <tr>
                      <th className="px-3 py-2.5 font-medium">Code</th>
                      <th className="px-3 py-2.5 font-medium">Objective</th>
                      <th className="px-3 py-2.5 font-medium">Severity</th>
                      <th className="px-3 py-2.5 font-medium">Lens</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayTemplates.map((t) => {
                      const id = templateId(t);
                      const cat = String(t.category ?? "");
                      const rowLens = lensForCategory(cat);
                      const meta = templateMetadata(t);
                      const active = selectedId === id;
                      return (
                        <tr
                          key={id}
                          className={cn(
                            "cursor-pointer border-b border-[#313131]/60 transition-colors hover:bg-[#1a1a1a]",
                            active && "bg-[#1a1f2e]"
                          )}
                          onClick={() => void selectObjective(t)}
                        >
                          <td className="px-3 py-2.5 font-mono text-[#6798ff]">{cat || "—"}</td>
                          <td className="px-3 py-2.5">
                            <p className="font-medium text-white">{String(t.name ?? "Untitled")}</p>
                            <p className="line-clamp-1 text-[11px] text-[#7c7c7c]">
                              {String(t.description ?? t.template ?? "").slice(0, 120)}
                            </p>
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[10px] text-[#a7a7a7]">
                            {meta.severity ?? "—"}
                          </td>
                          <td className="px-3 py-2.5 text-[#a7a7a7]">{rowLens}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-[#313131] bg-[#0a0a0a]">
            <div className="flex items-center justify-between border-b border-[#313131] px-3 py-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#6798ff]">
                Objective detail
              </p>
              {selectedId ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => {
                    setSelectedId(null);
                    setVersionData(null);
                  }}
                  aria-label="Clear selection"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </div>

            {!selected ? (
              <div className="flex min-h-[280px] items-center justify-center px-4 text-center">
                <p className="text-[13px] text-[#7c7c7c]">
                  Select an objective to inspect metadata, expand variables, and test.
                </p>
              </div>
            ) : (
              <div className="space-y-4 p-4">
                <div>
                  <p className="text-[15px] font-semibold text-white">
                    {String(selected.name ?? "Untitled")}
                  </p>
                  {selected.description ? (
                    <p className="mt-1 text-[12px] leading-relaxed text-[#a7a7a7]">
                      {String(selected.description)}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="meta-badge font-mono">
                      {String(selected.category ?? "—")}
                    </Badge>
                    <Badge variant="secondary" className="meta-badge">
                      {lensForCategory(String(selected.category ?? ""))}
                    </Badge>
                    {selectedMeta?.severity ? (
                      <Badge variant="outline" className="meta-badge font-mono">
                        {selectedMeta.severity}
                      </Badge>
                    ) : null}
                    {selectedMeta?.owasp_llm ? (
                      <Badge variant="outline" className="meta-badge font-mono">
                        {selectedMeta.owasp_llm}
                      </Badge>
                    ) : null}
                    {selectedMeta?.mitre_atlas ? (
                      <Badge variant="outline" className="meta-badge font-mono">
                        {selectedMeta.mitre_atlas}
                      </Badge>
                    ) : null}
                    {asiForAttackCategory(String(selected.category ?? "")) && (
                      <Badge variant="outline" className="meta-badge font-mono">
                        {asiForAttackCategory(String(selected.category ?? ""))!.code}
                      </Badge>
                    )}
                  </div>
                  {(selectedMeta?.tags?.length ?? 0) > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {selectedMeta!.tags!.map((tag) => (
                        <span
                          key={tag}
                          className="rounded border border-[#313131] px-1.5 py-0.5 font-mono text-[9px] text-[#7c7c7c]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {Object.keys(selectedVars).length > 0 && (
                  <div>
                    <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.08em] text-[#7c7c7c]">
                      Variables
                    </p>
                    <div className="space-y-1 rounded-[8px] border border-[#313131] bg-[#141414] p-2">
                      {Object.entries(selectedVars).map(([key, value]) => (
                        <div key={key} className="grid grid-cols-[88px_1fr] gap-2 text-[11px]">
                          <span className="font-mono text-[#6798ff]">{`{{${key}}}`}</span>
                          <span className="truncate text-[#a7a7a7]" title={value}>
                            {value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-[#7c7c7c]">
                      {showRawProbe ? "Raw template" : "Expanded probe"}
                    </p>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px]"
                        onClick={() => setShowRawProbe((v) => !v)}
                      >
                        {showRawProbe ? "Show expanded" : "Show raw"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px]"
                        onClick={() => void copyProbe()}
                      >
                        <Copy className="h-3 w-3" />
                        Copy
                      </Button>
                    </div>
                  </div>
                  <pre className="max-h-[220px] overflow-auto whitespace-pre-wrap break-words rounded-[8px] border border-[#313131] bg-[#141414] p-3 font-mono text-[11px] leading-relaxed text-[#a7a7a7]">
                    {showRawProbe ? String(selected.template ?? "—") : selectedExpanded || "—"}
                  </pre>
                </div>

                <div className="grid gap-2">
                  <Button asChild size="sm" className="w-full">
                    <Link href={sandboxHrefForTemplate(selected)}>
                      <Crosshair className="h-3.5 w-3.5" />
                      Test in Sandbox
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline" className="w-full">
                    <Link href={campaignHrefForTemplate(selected)}>
                      <Swords className="h-3.5 w-3.5" />
                      Use in new scan
                    </Link>
                  </Button>
                </div>

                <div>
                  <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.08em] text-[#7c7c7c]">
                    Version
                  </p>
                  {versionLoading ? (
                    <p className="text-[11px] text-[#7c7c7c]">Loading…</p>
                  ) : versionData ? (
                    <p className="text-[12px] text-[#a7a7a7]">
                      {versionData.note
                        ? "Built-in · not versioned"
                        : `Custom · v${versionData.current_version ?? 1}`}
                      {(versionData.history?.length ?? 0) > 0
                        ? ` · ${versionData.history!.length} prior edit${
                            versionData.history!.length === 1 ? "" : "s"
                          }`
                        : ""}
                    </p>
                  ) : (
                    <p className="text-[11px] text-[#454545]">Version info unavailable.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </PageStack>
  );
}

export default function AttackLibraryPage() {
  return (
    <Suspense fallback={<PageSuspenseFallback label="Loading attack library…" />}>
      <LibraryContent />
    </Suspense>
  );
}
