"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  ShieldCheck,
  Zap,
  Copy,
  Check,
  Layers,
  Activity,
  Terminal,
  ArrowUpRight,
  Search,
} from "lucide-react";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PromoteToPlaybookPanel } from "@/components/wargame/PromoteToPlaybookPanel";
import { FindingCustodyTrail } from "@/components/findings/FindingCustodyTrail";
import type { ExtendedFinding } from "@/lib/types/findings";
import { cn } from "@/lib/utils";

interface FindingWorkbenchViewProps {
  findings: ExtendedFinding[];
  selectedFinding: ExtendedFinding | null;
  onSelectFinding: (finding: ExtendedFinding) => void;
  onPromoted?: () => void;
}

export function FindingWorkbenchView({
  findings,
  selectedFinding,
  onSelectFinding,
  onPromoted,
}: FindingWorkbenchViewProps) {
  const [query, setQuery] = useState("");
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [activeTab, setActiveTab] = useState<"exploit" | "hotpatch" | "blast" | "custody">("exploit");

  const filtered = findings.filter((f) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      f.title.toLowerCase().includes(q) ||
      f.id.toLowerCase().includes(q) ||
      (f.target_agent ?? "").toLowerCase().includes(q) ||
      (f.asi_code ?? "").toLowerCase().includes(q) ||
      (f.mitre_atlas ?? "").toLowerCase().includes(q)
    );
  });

  const active = selectedFinding ?? filtered[0] ?? null;

  const handleCopy = () => {
    if (active?.attack_prompt) {
      void navigator.clipboard.writeText(active.attack_prompt);
      setCopiedPayload(true);
      setTimeout(() => setCopiedPayload(false), 2000);
    }
  };

  const isContained = active?.verdict?.toUpperCase() === "CONTAINED";
  const isBreached = active?.verdict?.toUpperCase() === "BREACHED";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
      {/* LEFT COLUMN (5 of 12 cols): High Density Findings Roster */}
      <div className="lg:col-span-5 rounded-xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden flex flex-col h-[760px]">
        {/* Roster Search Header */}
        <div className="p-3 border-b border-slate-200/80 bg-slate-50/50 space-y-2">
          <div className="flex items-center justify-between font-mono text-[11px] text-slate-700">
            <span className="font-bold uppercase tracking-wider">Target Fleet Findings</span>
            <span className="rounded bg-slate-200/70 px-1.5 py-0.5 font-bold text-slate-800">
              {filtered.length} of {findings.length}
            </span>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by ID, vector, model, or ATLAS..."
              className="h-8 pl-8 text-xs border-slate-200 bg-white placeholder:text-slate-400 focus:bg-white"
            />
          </div>
        </div>

        {/* Scrollable Findings List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-1">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs font-mono text-slate-400">
              No matching security findings found.
            </div>
          ) : (
            filtered.map((item) => {
              const isSelected = active?.id === item.id;
              const itemBreached = item.verdict?.toUpperCase() === "BREACHED";

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectFinding(item)}
                  className={cn(
                    "w-full text-left p-3 rounded-lg transition-all flex flex-col gap-1.5",
                    isSelected
                      ? "bg-blue-50/80 border border-blue-300/80 shadow-2xs ring-1 ring-blue-500/10"
                      : "hover:bg-slate-50/80 border border-transparent"
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 font-mono text-[10px]">
                      <span className="font-bold text-slate-600">{item.id}</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-slate-500">{item.asi_code}</span>
                      {item.mitre_atlas && (
                        <span className="text-slate-400 font-semibold">{item.mitre_atlas}</span>
                      )}
                    </div>
                    <SeverityBadge severity={item.severity} />
                  </div>

                  <p className={cn(
                    "text-xs font-bold leading-snug line-clamp-1",
                    isSelected ? "text-blue-950" : "text-slate-900"
                  )}>
                    {item.title}
                  </p>

                  <div className="flex items-center justify-between pt-0.5 font-mono text-[10px] text-slate-500">
                    <span className="truncate max-w-[170px] text-slate-700 font-medium">
                      {item.target_agent}
                    </span>
                    <span className={cn(
                      "font-bold uppercase inline-flex items-center gap-1",
                      itemBreached ? "text-rose-600" : "text-emerald-600"
                    )}>
                      {itemBreached ? (
                        <ShieldAlert className="h-2.5 w-2.5" />
                      ) : (
                        <ShieldCheck className="h-2.5 w-2.5" />
                      )}
                      {item.verdict ?? "UNCLASSIFIED"}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT COLUMN (7 of 12 cols): Instant Forensic Studio & Hotpatch Workbench */}
      <div className="lg:col-span-7 rounded-xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden flex flex-col h-[760px]">
        {active ? (
          <>
            {/* Active Header Ribbon */}
            <div className="p-4 border-b border-slate-200/80 bg-slate-50/70 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded border border-slate-200 bg-white px-2 py-0.5 font-mono text-xs font-bold text-slate-800 shadow-2xs">
                    {active.id}
                  </span>
                  <SeverityBadge severity={active.severity} />
                  {active.asi_code && (
                    <Badge variant="outline" className="border-blue-200 bg-blue-50 font-mono text-[10px] font-bold text-blue-700">
                      {active.asi_code}{active.mitre_atlas ? ` · ${active.mitre_atlas}` : ""}
                    </Badge>
                  )}
                  <span
                    className={cn(
                      "rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase",
                      isContained
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : isBreached
                        ? "bg-rose-50 text-rose-700 border border-rose-200"
                        : "bg-amber-50 text-amber-700 border border-amber-200"
                    )}
                  >
                    {active.verdict ?? "UNCLASSIFIED"}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-slate-200 font-mono gap-1 text-slate-700 hover:bg-slate-50 shadow-2xs"
                  >
                    {active.source_ref ? (
                      <Link href={`/replay?session=${encodeURIComponent(active.source_ref)}`}>
                        Fleet Replay
                        <ArrowUpRight className="h-3 w-3 text-slate-400" />
                      </Link>
                    ) : <span className="text-slate-400">Replay unavailable</span>}
                  </Button>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900 leading-snug">
                  {active.title}
                </h3>
                <div className="flex flex-wrap items-center gap-3 pt-1 font-mono text-[11px] text-slate-600">
                  <span>Target: <strong className="text-slate-800">{active.target_agent}</strong></span>
                  {active.target_model && (
                    <span>Model: <strong className="text-slate-800">{active.target_model}</strong></span>
                  )}
                  {active.namespace && (
                    <span>Namespace: <strong className="text-slate-800">{active.namespace}</strong></span>
                  )}
                  <span>Impact: <strong className="text-slate-800">{active.impact_score == null ? "—" : `${active.impact_score}/100`}</strong></span>
                </div>
              </div>
            </div>

            {/* Segmented Forensic Tabs */}
            <div className="flex items-center gap-1 border-b border-slate-200 px-4 pt-2 bg-slate-50/40">
              <button
                type="button"
                onClick={() => setActiveTab("exploit")}
                className={cn(
                  "flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-xs font-semibold font-mono transition-colors",
                  activeTab === "exploit"
                    ? "border-blue-600 text-blue-700 bg-white rounded-t"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                )}
              >
                <Terminal className="h-3.5 w-3.5" />
                Exploit Payload
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("hotpatch")}
                className={cn(
                  "flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-xs font-semibold font-mono transition-colors",
                  activeTab === "hotpatch"
                    ? "border-blue-600 text-blue-700 bg-white rounded-t"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                )}
              >
                <Zap className="h-3.5 w-3.5" />
                Policy Hotpatch Studio
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("blast")}
                className={cn(
                  "flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-xs font-semibold font-mono transition-colors",
                  activeTab === "blast"
                    ? "border-blue-600 text-blue-700 bg-white rounded-t"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                )}
              >
                <Layers className="h-3.5 w-3.5" />
                Recorded Blast Radius &amp; Identity Evidence
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("custody")}
                className={cn(
                  "flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-xs font-semibold font-mono transition-colors",
                  activeTab === "custody"
                    ? "border-blue-600 text-blue-700 bg-white rounded-t"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                )}
              >
                <Activity className="h-3.5 w-3.5" />
                HMAC Provenance
              </button>
            </div>

            {/* Scrollable Workbench Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* TAB 1: Exploit Vector */}
              {activeTab === "exploit" && (
                <div className="space-y-4">
                  {/* Exploit Payload Box */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-700">
                        Adversarial Prompt Vector
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-[11px] font-mono text-slate-600 hover:text-slate-900"
                        onClick={handleCopy}
                      >
                        {copiedPayload ? (
                          <>
                            <Check className="mr-1 h-3 w-3 text-emerald-600" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="mr-1 h-3 w-3" />
                            Copy Payload
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="rounded-lg border border-slate-300 bg-slate-950 p-3.5 text-xs font-mono text-slate-100 shadow-inner overflow-x-auto whitespace-pre-wrap leading-relaxed selection:bg-blue-600 selection:text-white">
                      {active.attack_prompt || "No prompt payload captured."}
                    </div>
                  </div>

                  {/* Interception Sensor Breakdown */}
                  <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
                    <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-700 block">
                      Runtime Detection &amp; Containment Analysis
                    </span>
                    <p className="text-xs text-slate-800 leading-relaxed font-medium">
                      {active.reasoning || "No evaluation rationale was recorded for this finding."}
                    </p>
                    {active.detection_layer && (
                      <div className="pt-2 border-t border-slate-200 flex items-center justify-between font-mono text-[11px] text-slate-600">
                        <span>Detection Mechanism:</span>
                        <span className="font-bold text-slate-900">{active.detection_layer}</span>
                      </div>
                    )}
                  </div>

                  {/* Remediation Hint */}
                  {active.remediation_hint && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3.5 space-y-1">
                      <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-blue-800 flex items-center gap-1">
                        <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                        Remediation Architecture
                      </span>
                      <p className="text-xs text-slate-700 leading-relaxed">
                        {active.remediation_hint}
                      </p>
                    </div>
                  )}

                  {/* Immediate Action: Promote to Defense Policy */}
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-amber-500" />
                      <span className="font-mono text-xs font-semibold text-slate-800">
                        {active.promoted_rule_name ? `Active Rule: ${active.promoted_rule_name}` : "Ready for Playbook Promotion"}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setActiveTab("hotpatch")}
                      className="h-7 bg-slate-900 text-white font-mono text-xs gap-1.5 hover:bg-slate-800 shadow-xs"
                    >
                      <Zap className="h-3 w-3 text-amber-400" />
                      Deploy Defense Patch
                    </Button>
                  </div>
                </div>
              )}

              {/* TAB 2: Policy Hotpatch Studio */}
              {activeTab === "hotpatch" && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs text-slate-600 leading-relaxed font-mono">
                    Draft a policy rule from this finding and review the backend suggestion before promotion.
                  </div>

                  <PromoteToPlaybookPanel
                    findingSource={active.attack_prompt ? {
                      content: active.attack_prompt,
                      title: active.title,
                      severity: active.severity,
                      category: active.category,
                      asiCode: active.asi_code,
                    } : null}
                    findingId={active.id}
                    onPromoted={onPromoted}
                  />
                </div>
              )}

              {/* TAB 3: Blast Radius & Identity */}
              {activeTab === "blast" && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-slate-200 p-3.5 space-y-3 bg-white">
                    <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-800 block">
                      Target Agent Perimeter &amp; Infrastructure
                    </span>
                    <div className="grid grid-cols-2 gap-2.5 font-mono text-xs">
                      <div className="rounded border border-slate-100 bg-slate-50 p-2">
                        <span className="text-[10px] text-slate-500 uppercase block">Agent Pod</span>
                        <span className="font-bold text-slate-900">{active.target_agent}</span>
                      </div>
                      <div className="rounded border border-slate-100 bg-slate-50 p-2">
                        <span className="text-[10px] text-slate-500 uppercase block">Model Family</span>
                        <span className="font-bold text-slate-900">{active.target_model ?? "—"}</span>
                      </div>
                      <div className="rounded border border-slate-100 bg-slate-50 p-2">
                        <span className="text-[10px] text-slate-500 uppercase block">Cluster Namespace</span>
                        <span className="font-bold text-slate-900">{active.namespace ?? "—"}</span>
                      </div>
                      <div className="rounded border border-slate-100 bg-slate-50 p-2">
                        <span className="text-[10px] text-slate-500 uppercase block">Isolation Protocol</span>
                        <span className="font-bold text-slate-900">{active.detection_layer ?? "—"}</span>
                      </div>
                    </div>

                    <div className="rounded border border-slate-200 bg-slate-50/80 p-3 font-mono text-xs space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Exposed Blast Radius</span>
                      <p className="text-slate-900 font-semibold break-all">
                        {active.blast_radius ?? "No blast radius was recorded for this finding."}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: Cryptographic Provenance */}
              {activeTab === "custody" && (
                <div className="space-y-3">
                  {active.custody_chain?.length ? (
                    <FindingCustodyTrail chain={active.custody_chain} />
                  ) : (
                    <div className="p-8 text-center text-xs font-mono text-slate-400">
                      No intermediate agent hops recorded for this telemetry finding.
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-8 text-center text-xs font-mono text-slate-400">
            Select a finding from the left roster to inspect forensic payload.
          </div>
        )}
      </div>
    </div>
  );
}
