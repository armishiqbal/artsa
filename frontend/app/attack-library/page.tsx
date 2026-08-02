"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Search, Plus, Loader2, Sparkles } from "lucide-react";
import { fetchFromBackend } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { DashboardCard } from "@/components/shared/DashboardCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function AttackLibraryPage() {
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

  const reload = () =>
    fetchFromBackend<{ categories: Array<{ code: string; name: string }>; templates: Array<Record<string, unknown>> }>(
      "/api/v1/attack-library",
      { silent: true }
    ).then((d) => d && setData(d));

  useEffect(() => {
    reload();
  }, []);

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

  return (
    <div className="space-y-8">
      <PageHeader
        title="Attack Library"
        description="Adversarial templates with MITRE ATLAS and OWASP LLM mappings."
        icon={<BookOpen className="h-5 w-5" />}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="gap-2" onClick={() => setShowCreate(!showCreate)}>
              <Plus className="h-4 w-4" />
              New template
            </Button>
            <Badge variant="secondary">{data.templates?.length ?? 0} templates</Badge>
          </div>
        }
      />

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
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedCategory === "ALL" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory("ALL")}
          >
            All
          </Button>
          {(data.categories || []).map((cat) => (
            <Button
              key={cat.code}
              variant={selectedCategory === cat.code ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(cat.code)}
            >
              {cat.code}
            </Button>
          ))}
        </div>
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
          <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
          Semantic search
          {searchBackend && (
            <Badge variant="outline" className="font-mono text-[10px]">
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
            <EmptyState
              icon={BookOpen}
              title="No templates found"
              description={
                useSemanticSearch
                  ? "Try a different query or switch category — semantic search ranks by embedding similarity."
                  : "Adjust filters or create a custom template."
              }
            />
          </div>
        ) : (
          displayTemplates.map((t, idx) => (
            <DashboardCard
              key={String(t.id ?? idx)}
              title={String(t.name)}
              badge={
                <div className="flex gap-1.5">
                  <Badge variant="info">{String(t.category)}</Badge>
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
              <pre className="max-h-32 overflow-auto rounded-lg border border-border bg-zinc-950 p-3 font-mono text-xs text-zinc-300">
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
                  <strong className="text-emerald-400">
                    {(((t.metadata as Record<string, unknown>)?.success_rate as number) ?? 0.4) * 100}%
                  </strong>
                </span>
              </div>
            </DashboardCard>
          ))
        )}
      </div>
    </div>
  );
}
