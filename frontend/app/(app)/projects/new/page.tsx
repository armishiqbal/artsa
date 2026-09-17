"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Shield,
  SlidersHorizontal,
  FileCheck2,
  ChevronDown,
  ChevronUp,
  Check,
  ExternalLink,
  Plus,
  Trash2,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProjectsStore, type ProjectMode } from "@/lib/stores/projects";
import { toast } from "@/lib/stores/toast";
import { cn } from "@/lib/utils";

const AVAILABLE_POLICIES = [
  "Content Safety",
  "Internal-facing Application",
  "ARTSA Default Policy",
  "Prompt Defense Only",
  "Public-facing Application",
];

interface CustomTag {
  id: string;
  key: string;
  value: string;
}

export default function CreateProjectPage() {
  const router = useRouter();
  const { addProject } = useProjectsStore();

  const [name, setName] = useState("");
  const [application, setApplication] = useState("");
  const [model, setModel] = useState("");
  const [customTags, setCustomTags] = useState<CustomTag[]>([]);

  // Project mode: null initially or "Detect" / "Enforce"
  const [mode, setMode] = useState<ProjectMode | null>(null);

  // Policy selector state
  const [policy, setPolicy] = useState("ARTSA Default Policy");
  const [policyOpen, setPolicyOpen] = useState(false);

  // Validation errors (matching Screenshot 5)
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const nameError = submitted && !name.trim();
  const modeError = submitted && !mode;

  const handleAddCustomTag = () => {
    setCustomTags([
      ...customTags,
      { id: Math.random().toString(36).slice(2, 9), key: "", value: "" },
    ]);
  };

  const handleUpdateTag = (id: string, field: "key" | "value", val: string) => {
    setCustomTags(
      customTags.map((t) => (t.id === id ? { ...t, [field]: val } : t))
    );
  };

  const handleRemoveTag = (id: string) => {
    setCustomTags(customTags.filter((t) => t.id !== id));
  };

  const handleSave = async () => {
    setSubmitted(true);
    if (!name.trim() || !mode) {
      toast("Please resolve project errors", {
        description: "Project name and mode are required",
        variant: "error",
      });
      return;
    }

    setSaving(true);
    try {
      // Build custom tags record
      const tagsMap: Record<string, string> = {};
      for (const t of customTags) {
        if (t.key.trim()) {
          tagsMap[t.key.trim()] = t.value.trim();
        }
      }

      addProject({
        name: name.trim(),
        mode,
        policy,
        application: application.trim() || undefined,
        model: model.trim() || undefined,
        customTags: tagsMap,
      });

      toast(`Project "${name.trim()}" created successfully`, {
        description: `Guardrail active in ${mode} Mode`,
        variant: "success",
      });

      router.push("/projects");
    } catch {
      toast("Failed to create project", { variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-16 pt-2">
      {/* Page Header (Matching Screenshot 4 & 5) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Create project
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Set up a project to manage how ARTSA Guard protects a specific application,
            environment, or component. Projects help you organize, track, and analyze
            security profiles across different parts of your GenAI-powered applications.
          </p>
        </div>

        {/* Action buttons with Screenshot 5 validation error display */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/projects")}
              className="h-10 rounded-lg px-4 text-sm font-medium"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="h-10 rounded-lg px-5 text-sm font-medium"
            >
              {saving ? "Saving..." : "Save project"}
            </Button>
          </div>

          {/* Validation errors matching Screenshot 5 */}
          {(nameError || modeError) && (
            <div className="flex flex-col items-end text-xs text-rose-600 dark:text-rose-400 font-medium">
              {nameError && <span>Project name is required</span>}
              {modeError && <span>Please select a mode to create the project</span>}
            </div>
          )}
        </div>
      </div>

      {/* Card 1: Project details (Matching Screenshot 4) */}
      <div className="rounded-xl border border-border/80 bg-card p-6 shadow-xs">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-foreground">Project details</h2>
          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            About projects
            <HelpCircle className="h-3 w-3" />
          </span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Name your project and create custom tags to categorize and track your GenAI application.
          Tags help you analyze activity across environments and applications, aiding in threat
          detection and performance comparison. They can also be used to match data with your
          external security tools, like a SIEM.
        </p>

        <div className="my-6 border-t border-border/60" />

        {/* GENERAL INFO */}
        <div className="space-y-4">
          <h3 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            General Info
          </h3>
          <div className="space-y-1.5">
            <label htmlFor="project-name" className="text-xs font-semibold text-foreground">
              Name<span className="text-rose-500">*</span>
            </label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my_project_1"
              className={cn(
                "h-10 text-xs",
                nameError && "border-rose-500 focus-visible:ring-rose-500"
              )}
            />
            {nameError && (
              <p className="text-[11px] text-rose-600 font-medium">
                Project name is required
              </p>
            )}
          </div>
        </div>

        <div className="my-6 border-t border-border/60" />

        {/* TAGS (Matching Screenshot 4) */}
        <div className="space-y-5">
          <div>
            <h3 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Tags
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Add project tags for filtering, analysis and comparisons across multiple projects
            </p>
          </div>

          <div className="space-y-1.5">
            <div>
              <span className="text-xs font-semibold text-foreground">Application</span>
              <span className="text-xs text-muted-foreground"> - Optional</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Specify the application or product this project relates to
            </p>
            <Input
              value={application}
              onChange={(e) => setApplication(e.target.value)}
              placeholder="e.g. Q&A"
              className="h-10 text-xs"
            />
          </div>

          <div className="my-4 border-t border-border/40" />

          <div className="space-y-1.5">
            <div>
              <span className="text-xs font-semibold text-foreground">Model</span>
              <span className="text-xs text-muted-foreground"> - Optional</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Specify the underlying LLM, e.g. GPT-3.5 Turbo.
            </p>
            <Input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g. GPT-4"
              className="h-10 text-xs"
            />
          </div>

          <div className="my-4 border-t border-border/40" />

          {/* Custom tags (Matching Screenshot 3) */}
          <div className="space-y-3">
            <div>
              <h4 className="text-xs font-semibold text-foreground">Custom tags</h4>
              <p className="text-[11px] text-muted-foreground">
                Add custom metadata fields for the project for filtering and analysis across multiple projects.
              </p>
            </div>

            {customTags.length > 0 && (
              <div className="space-y-2 pt-1">
                {customTags.map((t) => (
                  <div key={t.id} className="flex items-center gap-2">
                    <Input
                      value={t.key}
                      onChange={(e) => handleUpdateTag(t.id, "key", e.target.value)}
                      placeholder="Key (e.g. environment)"
                      className="h-9 text-xs flex-1"
                    />
                    <Input
                      value={t.value}
                      onChange={(e) => handleUpdateTag(t.id, "value", e.target.value)}
                      placeholder="Value (e.g. production)"
                      className="h-9 text-xs flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveTag(t.id)}
                      className="h-9 w-9 text-muted-foreground hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={handleAddCustomTag}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline pt-1"
            >
              <span>Add a custom tag</span>
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Card 2: Project mode (Matching Screenshot 3) */}
      <div
        className={cn(
          "rounded-xl border bg-card p-6 shadow-xs transition-colors",
          modeError ? "border-rose-500 ring-1 ring-rose-500" : "border-border/80"
        )}
      >
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">Project mode</h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Project mode defines whether Guard only observes detection behavior or actively
            enforces protection on live traffic. You can change this at any time.
          </p>
          {modeError && (
            <p className="text-[11px] text-rose-600 font-medium pt-1">
              Please select a mode to create the project
            </p>
          )}
        </div>

        {/* 2 Radio Selectable Cards Side by Side */}
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Detect Mode Card */}
          <div
            onClick={() => setMode("Detect")}
            className={cn(
              "relative flex cursor-pointer flex-col justify-between rounded-xl border p-5 transition-all hover:border-primary/60",
              mode === "Detect"
                ? "border-primary bg-primary/5 ring-1 ring-primary shadow-xs"
                : "border-border/80 bg-background hover:bg-muted/30"
            )}
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/80 bg-muted/40 text-primary">
                  <SlidersHorizontal className="h-4 w-4" />
                </div>
                {/* Radio Indicator */}
                <div
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded-full border transition-colors",
                    mode === "Detect"
                      ? "border-primary bg-primary"
                      : "border-muted-foreground/40"
                  )}
                >
                  {mode === "Detect" && (
                    <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                  )}
                </div>
              </div>

              <h3 className="mt-4 text-sm font-semibold text-foreground">Detect Mode</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Analyze and log real traffic without applying enforcement actions.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-border/40 text-[11px] font-medium text-foreground flex items-center gap-1">
              <span>Ideal for initial testing and calibration.</span>
            </div>
          </div>

          {/* Enforce Mode Card */}
          <div
            onClick={() => setMode("Enforce")}
            className={cn(
              "relative flex cursor-pointer flex-col justify-between rounded-xl border p-5 transition-all hover:border-primary/60",
              mode === "Enforce"
                ? "border-primary bg-primary/5 ring-1 ring-primary shadow-xs"
                : "border-border/80 bg-background hover:bg-muted/30"
            )}
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/80 bg-muted/40 text-primary">
                  <FileCheck2 className="h-4 w-4" />
                </div>
                {/* Radio Indicator */}
                <div
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded-full border transition-colors",
                    mode === "Enforce"
                      ? "border-primary bg-primary"
                      : "border-muted-foreground/40"
                  )}
                >
                  {mode === "Enforce" && (
                    <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                  )}
                </div>
              </div>

              <h3 className="mt-4 text-sm font-semibold text-foreground">Enforce Mode</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Actively protect live traffic using Guard&apos;s detection decisions.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-border/40 text-[11px] font-medium text-foreground flex items-center gap-1">
              <span>Ideal once your policy is tuned and ready.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Card 3: Policy details (Matching Screenshot 1 & 2) */}
      <div className="rounded-xl border border-border/80 bg-card p-6 shadow-xs">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-foreground">Policy details</h2>
          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            About policies
            <HelpCircle className="h-3 w-3" />
          </span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          A policy defines the guardrails applied to all API requests in assigned projects.
          These guardrails will flag any detected issues based on the configured threshold.
        </p>

        <div className="my-6 border-t border-border/60" />

        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-foreground">Assign a policy</h3>

          {/* Interactive Policy Dropdown Selector (Matching Screenshot 1 & 2) */}
          <div className="relative">
            {policyOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setPolicyOpen(false)}
                />
                <div className="absolute bottom-full mb-1.5 left-0 z-50 w-full rounded-xl border border-border bg-popover p-1 shadow-xl animate-in fade-in-50 zoom-in-95">
                  <div className="space-y-0.5">
                    {AVAILABLE_POLICIES.map((p) => {
                      const isSelected = policy === p;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => {
                            setPolicy(p);
                            setPolicyOpen(false);
                          }}
                          className={cn(
                            "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-xs transition-colors",
                            isSelected
                              ? "bg-muted font-semibold text-foreground"
                              : "text-foreground hover:bg-muted/50"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-primary" />
                            <span>{p}</span>
                          </div>
                          {isSelected && <Check className="h-4 w-4 text-foreground" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* Dropdown trigger matching Screenshot 1 & 2 */}
            <div
              onClick={() => setPolicyOpen(!policyOpen)}
              className={cn(
                "flex cursor-pointer items-center justify-between rounded-lg border bg-background px-3.5 py-2.5 text-xs transition-all",
                policyOpen
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-primary/80 hover:border-primary shadow-xs"
              )}
            >
              <div className="flex items-center gap-2 font-medium text-foreground">
                <Shield className="h-4 w-4 text-primary" />
                <span>{policy}</span>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href="/admin/policies"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  <span>Open policy</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
                {policyOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Create a new policy or edit an existing policy if your current policy options don&apos;t
            fit the requirements for this project.
          </p>

          <div>
            <Link
              href="/admin/policies"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <span>Go to Policies page</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
