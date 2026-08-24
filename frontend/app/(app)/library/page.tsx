"use client";

import { Suspense, useEffect, useMemo, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  BookOpen, Search, Plus, Loader2, Sparkles, Download,
  Upload, GitBranch, X, CheckCircle2, AlertTriangle, FileJson, Crosshair, Database
} from "lucide-react";
import { fetchFromBackend } from "@/lib/api";
import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";
import { FeatureLinkCard } from "@/components/shared/FeatureLinkCard";
import { DashboardCard } from "@/components/shared/DashboardCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { SegmentedControl } from "@/components/shared/SegmentedControl";
import { PageStack } from "@/components/shared/PageStack";
import { PageSuspenseFallback } from "@/components/shared/PageSuspenseFallback";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function LibraryContent() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<{ categories: Array<{ code: string; name: string }>; templates: Array<Record<string, unknown>> }>({
    categories: [],
    templates: [],
  });
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [semanticResults, setSemanticResults] = useState<Array<Record<string, unknown>> | null>(null);
  const [semanticLoading, setSemanticLoading] = useState(false);
  const [searchBackend, setSearchBackend] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: "", category: "DPI", template: "" });
  const [showImport, setShowImport] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; skipped: number } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [versionData, setVersionData] = useState<Record<string, unknown> | null>(null);
  const [versionLoading, setVersionLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reload = () =>
    fetchFromBackend<{ categories: Array<{ code: string; name: string }>; templates: Array<Record<string, unknown>> }>(
      "/api/v1/attack-library",
      { silent: true }
    ).then((d) => {
      if (d) setData(d);
      setLoaded(true);
    });

  useEffect(() => {
    reload();
  }, []);

  useEffect(() => {
    const category = searchParams.get("category");
    if (category) {
      setSelectedCategory(category.toUpperCase());
    }
  }, [searchParams]);

  const trimmedQuery = searchQuery.trim();
  const useSemanticSearch = trimmedQuery.length >= 2;

  useEffect(() => {
    if (!useSemanticSearch) {
      setSemanticResults(null);
      setSearchBackend(null);
      setSemanticLoading(false);
      return;
    }

    setSemanticLoading(true);
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ q: trimmedQuery, limit: "24" });
      if (selectedCategory !== "ALL") {
        params.set("category", selectedCategory);
      }
      fetchFromBackend<{
        results: Array<Record<string, unknown>>;
        backend: string;
        count: number;
      }>(`/api/v1/attack-library/search?${params.toString()}`, { silent: true })
        .then((res) => {
          if (res) {
            setSemanticResults(res.results ?? []);
            setSearchBackend(res.backend ?? null);
          }
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
    reload();
  };

  const handleExport = async () => {
    const catFilter = selectedCategory !== "ALL" ? selectedCategory : undefined;
    const params = new URLSearchParams();
    if (catFilter) params.set("category", catFilter);
    const data = await fetchFromBackend<{ templates: Array<Record<string, unknown>> }>(
      `/api/v1/attack-library/templates/export?${params.toString()}`,
      { silent: true }
    );
    if (data?.templates) {
      const blob = new Blob([JSON.stringify(data.templates, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attack-library-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleBulkImport = async () => {
    if (!importJson.trim()) return;
    setImporting(true);
    setImportResult(null);
    setImportError(null);

    // Surface bad JSON as its own error instead of a misleading "0 created".
    let parsed: unknown;
    try {
      parsed = JSON.parse(importJson);
    } catch {
      setImportError("Invalid JSON — check braces and quotes, then try again.");
      setImporting(false);
      return;
    }
    const templates = Array.isArray(parsed) ? parsed : [parsed];

    try {
      const data = await fetchFromBackend<{ created: number; skipped: number }>(
        "/api/v1/attack-library/templates/bulk-import",
        {
          method: "POST",
          body: JSON.stringify({ templates }),
        }
      );
      if (data) {
        setImportResult(data);
        reload();
      }
    } catch {
      setImportError("Import failed — the API didn't accept the payload.");
    } finally {
      setImporting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImportJson(String(ev.target?.result ?? ""));
    };
    reader.readAsText(file);
  };

  const handleVersionLookup = async (templateId: string) => {
    setSelectedVersionId(templateId);
    setVersionLoading(true);
    const data = await fetchFromBackend<Record<string, unknown>>(
      `/api/v1/attack-library/templates/${templateId}/versions`,
      { silent: true }
    );
    setVersionData(data);
    setVersionLoading(false);
  };

  const filteredTemplates = useMemo(
    () =>
      (data.templates || []).filter((t) => {
        const matchCat = selectedCategory === "ALL" || t.category === selectedCategory;
        const q = searchQuery.toLowerCase();
        if (!q) return matchCat;
        const name = String(t.name ?? "").toLowerCase();
        const template = String(t.template ?? "").toLowerCase();
        return matchCat && (name.includes(q) || template.includes(q));
      }),
    [data.templates, selectedCategory, searchQuery]
  );

  const displayTemplates = useSemanticSearch ? (semanticResults ?? []) : filteredTemplates;

  const categoryOptions = useMemo(
    () => [
      { value: "ALL", label: "All" },
      ...(data.categories || []).map((c) => ({ value: c.code, label: c.code })),
    ],
    [data.categories]
  );

  return (
    <PageStack>
      <PageHeader
        title="Attack Library"
        description="Adversarial templates with MITRE ATLAS and OWASP LLM mappings."
        icon={<BookOpen className="h-5 w-5" />}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="gap-2" onClick={() => setShowImport(!showImport)}>
              <Upload className="h-4 w-4" />
              Bulk Import
            </Button>
            <Button size="sm" variant="outline" className="gap-2" onClick={handleExport}>
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button size="sm" variant="outline" className="gap-2" onClick={() => setShowCreate(!showCreate)}>
              <Plus className="h-4 w-4" />
              New template
            </Button>
            <Badge variant="secondary" className="meta-badge">{data.templates?.length ?? 0} templates</Badge>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <FeatureLinkCard
          href="/sandbox"
          icon={Crosshair}
          title="Attack Sandbox"
          description="Live guard presets — injection, jailbreak, PII"
        />
        <FeatureLinkCard
          href="/rag-scanner"
          icon={Database}
          title="RAG corpus scan"
          description="Offline poison detection on exported chunks"
        />
      </div>

      {/* Bulk Import Panel */}
      {showImport && (
        <DashboardCard title="Bulk Import Templates">
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Paste a JSON array of templates or upload a .json file. Each entry needs <code>name</code>, <code>category</code>, and <code>template</code>.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => fileInputRef.current?.click()}>
                <FileJson className="h-4 w-4" />
                Upload JSON file
              </Button>
              <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileUpload} />
            </div>
            <textarea
              className="w-full min-h-40 rounded-md border bg-background px-3 py-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder='[{"name": "Example", "category": "DPI", "template": "..."}]'
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleBulkImport} disabled={importing || !importJson.trim()}>
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Import"}
              </Button>
              {importError && (
                <span className="flex items-center gap-1 text-xs text-severity-critical">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                  {importError}
                </span>
              )}
              {!importError && importResult && (
                <span className="text-xs text-muted-foreground">
                  {importResult.created > 0 ? (
                    <span className="flex items-center gap-1 text-status-success">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Created {importResult.created}, skipped {importResult.skipped}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-status-warning">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      No templates created
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>
        </DashboardCard>
      )}

      {/* Version Panel */}
      {selectedVersionId && (
        <DashboardCard
          title={`Version History · ${versionData?.name ?? selectedVersionId}`}
          badge={
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setSelectedVersionId(null)}
              aria-label="Close version history"
            >
              <X className="h-4 w-4" aria-hidden />
            </Button>
          }
        >
          {versionLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading versions…
            </div>
          ) : versionData ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">v{String(versionData.current_version ?? 1)}</Badge>
                <span className="text-xs text-muted-foreground">{String(versionData.category ?? "—")}</span>
              </div>
              {String(versionData.note ?? "") && (
                <p className="text-xs text-muted-foreground italic">{String(versionData.note)}</p>
              )}
              {Array.isArray(versionData.history) && (versionData.history as Array<Record<string, unknown>>).length > 0 ? (
                <ul className="space-y-1">
                  {(versionData.history as Array<Record<string, unknown>>).map((entry, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <GitBranch className="h-3 w-3" />
                      v{String(entry.version)} — {String(entry.changed_at ?? "unknown date")}
                      {entry.change_summary ? ` — ${String(entry.change_summary)}` : ""}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">No version history recorded.</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Template not found.</p>
          )}
        </DashboardCard>
      )}

      {showCreate && (
        <DashboardCard title="Create Template">
          <div className="grid gap-3 md:grid-cols-2">
            <Input placeholder="Name" value={newTemplate.name} onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })} />
            <Input placeholder="Category (DPI, JBK…)" value={newTemplate.category} onChange={(e) => setNewTemplate({ ...newTemplate, category: e.target.value })} />
            <textarea
              className="md:col-span-2 min-h-24 w-full rounded-md border border-input bg-background p-3 font-mono text-xs"
              placeholder="Attack template text…"
              value={newTemplate.template}
              onChange={(e) => setNewTemplate({ ...newTemplate, template: e.target.value })}
            />
          </div>
          <Button size="sm" className="mt-3" onClick={createTemplate}>Save template</Button>
        </DashboardCard>
      )}

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <SegmentedControl
          options={categoryOptions}
          value={selectedCategory}
          onChange={setSelectedCategory}
          layoutId="library-category-filter"
          className="max-w-full overflow-x-auto"
        />
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            placeholder="Search vectors (semantic at 2+ chars)…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9"
            aria-label="Search attack templates"
          />
          {semanticLoading && (
            <Loader2
              className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground"
              aria-hidden
            />
          )}
        </div>
      </div>

      {useSemanticSearch && (
        <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          Semantic search
          {searchBackend && (
            <Badge variant="outline" className="meta-badge font-mono">
              {searchBackend}
            </Badge>
          )}
          {!semanticLoading && (
            <span>
              · {displayTemplates.length} match{displayTemplates.length === 1 ? "" : "es"}
            </span>
          )}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {displayTemplates.length === 0 ? (
          <div className="col-span-full">
            {!loaded ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-56 rounded-xl" />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={BookOpen}
                title="No templates found"
                description={
                  useSemanticSearch
                    ? "Try a different query or switch category — semantic search ranks by embedding similarity."
                    : "Adjust filters or create a custom template."
                }
              />
            )}
          </div>
        ) : (
          displayTemplates.map((t, idx) => (
            <DashboardCard
              key={String(t.id ?? idx)}
              title={String(t.name)}
              badge={
                <div className="flex gap-1.5">
                  <Badge variant="info">{String(t.category)}</Badge>
                  {typeof t.version === "number" && t.version > 1 && (
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      v{String(t.version)}
                    </Badge>
                  )}
                  {typeof t.score === "number" && (
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      score {(t.score as number).toFixed(2)}
                    </Badge>
                  )}
                </div>
              }
              contentClassName="space-y-3"
            >
              <div className="flex flex-wrap gap-1.5">
                {Boolean((t.metadata as Record<string, unknown>)?.owasp_llm) && (
                  <Badge variant="critical" className="text-[10px]">
                    {String((t.metadata as Record<string, unknown>).owasp_llm)}
                  </Badge>
                )}
                {Boolean((t.metadata as Record<string, unknown>)?.mitre_atlas) && (
                  <Badge variant="warning" className="text-[10px]">
                    {String((t.metadata as Record<string, unknown>).mitre_atlas)}
                  </Badge>
                )}
              </div>
              <pre className="code-block max-h-32">
                {String(t.template)}
              </pre>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  Severity:{" "}
                  <strong className="text-severity-medium">
                    {String((t.metadata as Record<string, unknown>)?.severity ?? "MEDIUM")}
                  </strong>
                </span>
                <span>
                  Success:{" "}
                  <strong className="text-status-success">
                    {Math.round(((((t.metadata as Record<string, unknown>)?.success_rate as number) ?? 0.4) * 100))}%
                  </strong>
                </span>
                <button
                  type="button"
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => handleVersionLookup(String(t.id))}
                  title="View version history"
                >
                  <GitBranch className="h-3 w-3" />
                  v{String(t.version ?? 1)}
                </button>
              </div>
              <Button asChild size="sm" className="w-full">
                <Link href={`/sandbox?template=${encodeURIComponent(String(t.id ?? ""))}`}>
                  <Crosshair className="h-3.5 w-3.5" />
                  Use in sandbox
                </Link>
              </Button>
            </DashboardCard>
          ))
        )}
      </div>
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
