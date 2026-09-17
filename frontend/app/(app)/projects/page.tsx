"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Shield,
  SlidersHorizontal,
  FileCheck2,
  ScrollText,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProjectsStore } from "@/lib/stores/projects";
import { toast } from "@/lib/stores/toast";
import { cn } from "@/lib/utils";

function formatDate(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return isoStr;
  }
}

export default function ProjectsPage() {
  const { projects, loadProjects, removeProject } = useProjectsStore();
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const filteredProjects = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.policy.toLowerCase().includes(q) ||
        p.mode.toLowerCase().includes(q) ||
        (p.application && p.application.toLowerCase().includes(q)) ||
        (p.model && p.model.toLowerCase().includes(q))
    );
  }, [projects, search]);

  const handleDelete = (id: string, name: string) => {
    removeProject(id);
    toast(`Project "${name}" deleted`, { variant: "default" });
  };

  return (
    <div className="space-y-6 pb-12 pt-2">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Projects
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your AI security projects, assigned guardrail policies, and enforcement modes.
          </p>
        </div>

        <Button asChild className="h-9 gap-1.5 rounded-lg px-4 text-xs font-medium">
          <Link href="/projects/new">
            <Plus className="h-3.5 w-3.5" />
            <span>Create project</span>
          </Link>
        </Button>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="h-9 pl-8 text-xs"
          />
        </div>
      </div>

      {/* Projects Table or Empty State matching the design system */}
      <div className="relative min-h-[420px] overflow-hidden rounded-lg border border-border/70 bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-[13px]">
            <thead className="border-b border-border/70 bg-[#fafafa] font-normal text-muted-foreground dark:bg-muted/20">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  Name
                </th>
                <th scope="col" className="px-3 py-3 font-medium">
                  Project mode
                </th>
                <th scope="col" className="px-3 py-3 font-medium">
                  Policy
                </th>
                <th scope="col" className="px-3 py-3 font-medium">
                  Application
                </th>
                <th scope="col" className="px-3 py-3 font-medium">
                  Model
                </th>
                <th scope="col" className="px-3 py-3 font-medium">
                  Tags
                </th>
                <th scope="col" className="px-3 py-3 font-medium">
                  Created
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border/50">
              {filteredProjects.length === 0 ? (
                // Empty state matching Screenshot 2
                <tr>
                  <td colSpan={8} className="py-32 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <p className="text-[13px] font-medium text-foreground">
                        No results found
                      </p>
                      {search ? (
                        <button
                          type="button"
                          onClick={() => setSearch("")}
                          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary"
                        >
                          <X className="h-3 w-3" />
                          Clear search filter
                        </button>
                      ) : (
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="mt-2 h-8 rounded-lg text-xs"
                        >
                          <Link href="/projects/new">Create your first project</Link>
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProjects.map((project) => (
                  <tr
                    key={project.id}
                    className="text-xs transition-colors hover:bg-muted/40"
                  >
                    {/* Name */}
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">
                      <Link
                        href={`/logs?project=${encodeURIComponent(project.id)}`}
                        className="hover:text-primary hover:underline"
                      >
                        {project.name}
                      </Link>
                    </td>

                    {/* Mode */}
                    <td className="whitespace-nowrap px-3 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium uppercase",
                          project.mode === "Enforce"
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {project.mode === "Enforce" ? (
                          <FileCheck2 className="h-3 w-3" />
                        ) : (
                          <SlidersHorizontal className="h-3 w-3" />
                        )}
                        {project.mode}
                      </span>
                    </td>

                    {/* Policy */}
                    <td className="whitespace-nowrap px-3 py-3">
                      <div className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <Shield className="h-3.5 w-3.5 text-primary" />
                        <span className="font-mono text-[11px] text-foreground">
                          {project.policy}
                        </span>
                      </div>
                    </td>

                    {/* Application */}
                    <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">
                      {project.application || "—"}
                    </td>

                    {/* Model */}
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-[11px] text-muted-foreground">
                      {project.model || "—"}
                    </td>

                    {/* Tags */}
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(project.customTags ?? {}).length > 0 ? (
                          Object.entries(project.customTags).map(([k, v]) => (
                            <span
                              key={k}
                              className="inline-flex items-center rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                            >
                              {k}:{v}
                            </span>
                          ))
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </div>
                    </td>

                    {/* Created */}
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-[11px] text-muted-foreground">
                      {formatDate(project.createdAt)}
                    </td>

                    {/* Actions */}
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <Link href={`/logs?project=${encodeURIComponent(project.id)}`}>
                            <ScrollText className="h-3 w-3" />
                            Logs
                          </Link>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(project.id, project.name)}
                          className="h-7 w-7 text-muted-foreground hover:text-rose-600"
                          title="Delete project"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
